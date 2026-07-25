/**
 * Field-level changes between two document snapshots.
 *
 * The structural diff is `@sanity/diff`'s — `diffInput` over two wrapped
 * documents returns an `ObjectDiff` whose per-field `Diff` already ignores the
 * document envelope (`_id`/`_rev`/`_type`/timestamps) and drops `undefined`
 * entries. What stays ours is the six-value editorial magnitude vocabulary,
 * which the AI prompt and the reviewer's badge tones both read and which
 * `@sanity/diff`'s four actions cannot express.
 *
 * Magnitude is derived from the diff's own segment char counts rather than a
 * positional scan.
 */

import type {Diff} from '@sanity/diff'

import {diffInput, wrap} from '@sanity/diff'
import {isDeepEmpty, resolveTypeName} from '@sanity/util/content'

import {isRecord} from './isRecord'
import {changedCharCount, diffTextSegments} from './textDiff'

export type FieldChangeMagnitude =
  | 'unchanged'
  | 'minor'
  | 'updated'
  | 'rewritten'
  | 'added'
  | 'removed'

export type FieldType =
  | 'string'
  | 'portableText'
  | 'array'
  | 'number'
  | 'boolean'
  | 'image'
  | 'reference'
  | 'other'

export interface FieldChange {
  /** Field path (e.g., 'title', 'body', 'excerpt') */
  fieldName: string
  changed: boolean
  magnitude: FieldChangeMagnitude
  /** Detected field type for Tier 3 inline diff routing */
  fieldType: FieldType
  /** Value from the historical (pre-stale) document snapshot */
  oldValue?: unknown
  /** Value from the current source document */
  newValue?: unknown
}

/** Magnitude thresholds, as a share of the characters on both sides of the field. */
const MINOR_THRESHOLD = 0.2
const REWRITTEN_THRESHOLD = 0.7

/**
 * Not content, whatever the diff says. `@sanity/diff` already skips the document
 * envelope; `language` is the locale marker every field-tier projection carries,
 * and a leading underscore is Sanity's own namespace.
 */
function isSystemField(fieldName: string): boolean {
  return fieldName.startsWith('_') || fieldName === 'language'
}

/** Portable Text — blocks with children — rather than any other array. */
function isPortableText(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((item) => isRecord(item) && item._type === 'block' && 'children' in item)
  )
}

/**
 * `resolveTypeName` is the reader the Studio's own form layer uses: a declared
 * `_type` wins, anything else falls back to its JS type. Uses the most
 * informative value — prefers non-null, prefers new.
 */
export function detectFieldType(oldValue: unknown, newValue: unknown): FieldType {
  const value = newValue ?? oldValue

  switch (resolveTypeName(value)) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'image':
      return 'image'
    case 'reference':
      return 'reference'
    case 'array':
      return isPortableText(value) ? 'portableText' : 'array'
    default:
      // A reference written without its `_type`, which the Studio tolerates.
      return isRecord(value) && '_ref' in value ? 'reference' : 'other'
  }
}

/** Every character of every string in a value — an added subtree's whole weight. */
function textLength(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + textLength(item), 0)
  if (isRecord(value)) {
    return Object.entries(value).reduce(
      (total, [key, entry]) => (isSystemField(key) ? total : total + textLength(entry)),
      0,
    )
  }
  return 0
}

/** Characters the edit touched, and characters it had to work with. */
interface CharCounts {
  changed: number
  total: number
}

function sum(counts: readonly CharCounts[]): CharCounts {
  return counts.reduce(
    (all, entry) => ({changed: all.changed + entry.changed, total: all.total + entry.total}),
    {changed: 0, total: 0},
  )
}

/** One whole side arrived or left — every character of it counts as touched. */
function wholeSubtree(diff: Diff<null>): CharCounts {
  const length = textLength(diff.fromValue) + textLength(diff.toValue)
  return {changed: length, total: length}
}

/**
 * A string's own segments are the ground truth; containers sum their children,
 * so an edit inside one span of one Portable Text block scores against the whole
 * field rather than against that span.
 */
function diffCharCounts(diff: Diff<null>): CharCounts {
  if (diff.action === 'added' || diff.action === 'removed') return wholeSubtree(diff)

  switch (diff.type) {
    case 'string':
      if (!diff.isChanged) return {changed: 0, total: diff.fromValue.length * 2}
      return {
        changed: changedCharCount(diffTextSegments(diff.fromValue, diff.toValue)),
        total: diff.fromValue.length + diff.toValue.length,
      }
    case 'object':
      return sum(
        Object.entries(diff.fields).flatMap(([key, field]) =>
          isSystemField(key) ? [] : [diffCharCounts(field)],
        ),
      )
    case 'array':
      return sum(diff.items.map((item) => diffCharCounts(item.diff)))
    default:
      return diff.isChanged ? wholeSubtree(diff) : {changed: 0, total: textLength(diff.toValue) * 2}
  }
}

function magnitudeOf(diff: Diff<null>): FieldChangeMagnitude {
  const fromEmpty = isDeepEmpty(diff.fromValue)
  const toEmpty = isDeepEmpty(diff.toValue)

  if (fromEmpty && toEmpty) return 'unchanged'
  if (fromEmpty) return 'added'
  if (toEmpty) return 'removed'
  if (!diff.isChanged) return 'unchanged'

  const {changed, total} = diffCharCounts(diff)
  if (total === 0 || changed === 0) return 'minor'

  const ratio = changed / total
  if (ratio < MINOR_THRESHOLD) return 'minor'
  if (ratio < REWRITTEN_THRESHOLD) return 'updated'
  return 'rewritten'
}

/**
 * The vocabulary is the contract callers depend on; the derivation behind it is
 * not.
 */
export function computeMagnitude(oldValue: unknown, newValue: unknown): FieldChangeMagnitude {
  if (isDeepEmpty(oldValue) && isDeepEmpty(newValue)) return 'unchanged'
  if (isDeepEmpty(oldValue)) return 'added'
  if (isDeepEmpty(newValue)) return 'removed'
  return magnitudeOf(diffInput<null>(wrap(oldValue, null), wrap(newValue, null)))
}

/** The magnitude vocabulary, most severe first. */
const MAGNITUDE_ORDER: Record<FieldChangeMagnitude, number> = {
  rewritten: 0,
  removed: 1,
  added: 2,
  updated: 3,
  minor: 4,
  unchanged: 5,
}

export function computeFieldChanges(
  historicalDoc: Record<string, unknown>,
  currentDoc: Record<string, unknown>,
): FieldChange[] {
  const diff = diffInput<null>(wrap(historicalDoc, null), wrap(currentDoc, null))
  if (diff.type !== 'object') return []

  const changes: FieldChange[] = []

  for (const [fieldName, fieldDiff] of Object.entries(diff.fields)) {
    if (isSystemField(fieldName)) continue

    const {fromValue: oldValue, toValue: newValue} = fieldDiff
    const magnitude = magnitudeOf(fieldDiff)

    changes.push({
      fieldName,
      changed: magnitude !== 'unchanged',
      magnitude,
      fieldType: detectFieldType(oldValue, newValue),
      oldValue,
      newValue,
    })
  }

  changes.sort((a, b) => MAGNITUDE_ORDER[a.magnitude] - MAGNITUDE_ORDER[b.magnitude])

  return changes
}
