/**
 * What a human changed about a machine translation, and whether it is worth
 * asking a model about.
 *
 * The learning loop's whole cost control lives here. Every approved run reaches
 * this code; only the ones carrying real signal reach an AI call. So the gate is
 * pure, exhaustively specified, and runs BEFORE any spend — a reviewer who fixed
 * a comma must not cost anything.
 */

import type {FieldChange} from './computeFieldChanges'

import {computeFieldChanges} from './computeFieldChanges'
import {extractBlockText} from './extractBlockText'

/** Fewer changed words than this across the whole run and nothing is asked. */
export const MIN_CHANGED_WORDS = 3

/**
 * Above this share of changed words a locale was rewritten rather than
 * corrected. Terminology extracted from a rewrite is guesswork — the honest
 * reading is "the machine's register was wrong", which is a style rule.
 */
export const STYLE_ONLY_RATIO = 0.8

/** One locale's two sides, already reduced to comparable field values. */
export interface DistillDeltaInput {
  locale: string
  /** The machine draft, read back at `machineRev`. */
  machine: Record<string, unknown>
  /** The text the reviewer approved. */
  human: Record<string, unknown>
}

export interface DistillDeltaOptions {
  /**
   * Field paths the SOURCE itself moved since the analysis ran. Their target
   * text differs because the English differs, not because a human corrected a
   * translation — attributing that to the machine would teach the loop noise.
   */
  sourceChangedFields?: Iterable<string>
}

/** One field a human actually rewrote, with both sides for the prompt. */
export interface DistillSpan {
  fieldPath: string
  machineText: string
  humanText: string
  /** Words added plus words removed, as multisets, after normalization. */
  changedWords: number
  /**
   * `changedWords` over the two sides' word counts combined — so a wholesale
   * rewrite reads as 1.0 whatever the length, and a one-word fix in a sentence
   * reads as a small fraction.
   */
  changedRatio: number
}

export interface LocaleDelta {
  locale: string
  spans: DistillSpan[]
  changedWords: number
  changedRatio: number
  /** Every surviving span is a rewrite: propose style rules, never terms. */
  styleOnly: boolean
}

/**
 * Why a run produced nothing. Recorded on the claim document so a quiet run is
 * distinguishable from a broken one.
 */
export type DistillSkipReason = 'below-threshold' | 'no-human-edits'

export interface DistillDelta {
  /** Only the locales a human edited, in input order. */
  locales: LocaleDelta[]
  changedWords: number
  /**
   * Locales whose machine output the human left untouched. Free deterministic
   * eval cases — the model already agreed with itself and a person signed it off.
   */
  cleanLocales: string[]
  /** Non-null when no AI call is warranted. */
  skipReason: DistillSkipReason | null
}

/**
 * Reduce a stored value to the text a translator would have typed.
 *
 * Anything that is not text — a slug, an image, a reference, a number — has no
 * translation to correct, so it yields nothing and drops out of the gate.
 */
export function distillText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractBlockText).filter(Boolean).join(' ')
  return ''
}

/**
 * NFC, whitespace collapsed, trimmed.
 *
 * Composed and decomposed forms of the same accented word are the same
 * correction, and a reviewer's stray newline is not one at all. Both sides of
 * every comparison below go through here first.
 */
export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** Lowercased, punctuation stripped — the form casing and punctuation cannot survive. */
function bareForm(value: string): string {
  return normalizeText(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(value: string): string[] {
  const bare = bareForm(value)
  return bare ? bare.split(' ') : []
}

/**
 * Words present on one side and not the other, counted as multisets.
 *
 * Deliberately not a sequence diff: a moved word is not a correction, and the
 * reordering check below has already dropped the runs that only moved. What is
 * left is "which words did the human swap", which is exactly a multiset delta —
 * and it needs no diff library to be deterministic.
 */
function changedWordCount(machine: string[], human: string[]): number {
  const remaining = new Map<string, number>()
  for (const word of machine) remaining.set(word, (remaining.get(word) ?? 0) + 1)

  let added = 0
  for (const word of human) {
    const held = remaining.get(word) ?? 0
    if (held > 0) remaining.set(word, held - 1)
    else added += 1
  }

  let removed = 0
  for (const count of remaining.values()) removed += count

  return added + removed
}

/** Same words, different order — a translator's clause swap, not a lesson. */
function isReordering(machine: string[], human: string[]): boolean {
  if (machine.length !== human.length) return false
  return [...machine].sort().join(' ') === [...human].sort().join(' ')
}

function changedTextFields(change: FieldChange): boolean {
  if (!change.changed) return false
  return change.fieldType === 'string' || change.fieldType === 'portableText'
}

/**
 * The spans of one locale that survive the noise gate.
 *
 * Order of the checks matters only for the reason a span is dropped, which
 * nothing downstream reads — but each is cheaper than the one after it.
 */
function localeSpans(input: DistillDeltaInput, sourceChanged: Set<string>): DistillSpan[] {
  const spans: DistillSpan[] = []

  for (const change of computeFieldChanges(input.machine, input.human)) {
    if (!changedTextFields(change)) continue
    if (sourceChanged.has(change.fieldName)) continue

    const machineText = normalizeText(distillText(change.oldValue))
    const humanText = normalizeText(distillText(change.newValue))

    // Whitespace-only, once normalized.
    if (machineText === humanText) continue
    // Punctuation or casing alone.
    if (bareForm(machineText) === bareForm(humanText)) continue

    const machineWords = words(machineText)
    const humanWords = words(humanText)
    if (isReordering(machineWords, humanWords)) continue

    const changedWords = changedWordCount(machineWords, humanWords)
    if (changedWords === 0) continue

    const total = machineWords.length + humanWords.length
    spans.push({
      fieldPath: change.fieldName,
      machineText,
      humanText,
      changedWords,
      changedRatio: total === 0 ? 0 : changedWords / total,
    })
  }

  return spans
}

/**
 * The whole gate: per-locale spans, the totals, and the verdict on whether an
 * AI call is warranted.
 *
 * A locale with no surviving span is not a failure — it is a locale the machine
 * got right, which is the loop's most valuable artifact after a correction.
 */
export function computeDistillDelta(
  inputs: readonly DistillDeltaInput[],
  options: DistillDeltaOptions = {},
): DistillDelta {
  const sourceChanged = new Set(options.sourceChangedFields ?? [])

  const locales: LocaleDelta[] = []
  const cleanLocales: string[] = []

  for (const input of inputs) {
    const spans = localeSpans(input, sourceChanged)
    if (spans.length === 0) {
      cleanLocales.push(input.locale)
      continue
    }

    const changedWords = spans.reduce((total, span) => total + span.changedWords, 0)
    const wordCount = spans.reduce(
      (total, span) => total + words(span.machineText).length + words(span.humanText).length,
      0,
    )
    locales.push({
      locale: input.locale,
      spans,
      changedWords,
      changedRatio: wordCount === 0 ? 0 : changedWords / wordCount,
      // Every span, not any: one rewritten field beside a targeted correction
      // still leaves a term worth extracting.
      styleOnly: spans.every((span) => span.changedRatio > STYLE_ONLY_RATIO),
    })
  }

  const changedWords = locales.reduce((total, locale) => total + locale.changedWords, 0)

  return {
    locales,
    changedWords,
    cleanLocales,
    skipReason: skipReasonFor(locales.length, changedWords),
  }
}

function skipReasonFor(editedLocales: number, changedWords: number): DistillSkipReason | null {
  if (editedLocales === 0) return 'no-human-edits'
  if (changedWords < MIN_CHANGED_WORDS) return 'below-threshold'
  return null
}
