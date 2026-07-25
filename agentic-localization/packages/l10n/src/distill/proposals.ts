/**
 * What the loop is allowed to propose, and what it is allowed to believe.
 *
 * Two rules govern everything here:
 *
 * - **Automation proposes, never decides.** A proposal is written as a DRAFT of
 *   a document whose `status` a human sets. Nothing this module emits can reach
 *   a prompt (`isReviewed` in `prompts/promptAssembly.ts` is the other half).
 * - **A model's claim is checked against the text, not trusted.** A term has to
 *   appear verbatim in the source and its correction verbatim in what the human
 *   approved, or it is dropped. The same shape as `parseAnalysisResponse`.
 *
 * And one hard prohibition: a proposal may never carry `doNotTranslate`. Pinning
 * a phrase in the source language is a brand decision, and a diff is not
 * evidence of one — a translator dropping a word once would teach the loop to
 * stop translating it forever.
 */

import {createHash} from 'node:crypto'

import {isRecord} from '../core/isRecord'
import {
  MODEL_PROPOSAL_KINDS,
  type ModelProposalKind,
  type ProposalKind,
} from '../core/proposalKinds'
import {proposalTypeName} from '../core/typeNames'

/** The vocabulary lives in `core/`, where the Studio can read it too. */
export {
  isProposalKind,
  MODEL_PROPOSAL_KINDS,
  PROPOSAL_KINDS,
  type ModelProposalKind,
  type ProposalKind,
} from '../core/proposalKinds'

/** A row the model returned, after validation. */
export interface ModelProposal {
  kind: ModelProposalKind
  locale: string
  rationale: string
  fieldPath: string
  /** `glossary-term`: the source term, verbatim. */
  term?: string
  /** `glossary-term`: what the human used instead, verbatim. */
  translation?: string
  /** `style-rule`: one instruction, in the imperative. */
  rule?: string
}

/** Where the coordinates of a reproducible eval case live. */
export interface EvalCaseCoordinates {
  locale: string
  targetId: string
  targetRev: string
  sourceRev: string
}

/** The three spans a reviewer needs to judge a proposal without leaving the form. */
export interface ProposalEvidence {
  fieldPath: string
  sourceExcerpt: string
  machineText: string
  humanText: string
}

/** A proposal as it lands in the lake — always at a `drafts.` id. */
export interface ProposalDocument {
  _id: string
  _type: typeof proposalTypeName
  kind: ProposalKind
  locale: string
  rationale: string
  /** How many distilled runs have now produced this same proposal. */
  occurrences: number
  /** The workflow instance that produced it. A plain string: it lives in another dataset. */
  run: string
  /** Weak, because the source may be deleted long before anyone reviews this. */
  subject?: {_type: 'reference'; _ref: string; _weak: true}
  evidence?: ProposalEvidence
  term?: string
  translation?: string
  rule?: string
  coordinates?: EvalCaseCoordinates
}

/** What `parseProposalResponse` needs in order to disbelieve the model. */
export interface ProposalValidationContext {
  /** Every configured `l10n.locale` code. A hallucinated tag proposes nothing. */
  locales: ReadonlySet<string>
  /** The source document's text. A term absent from it was never translated. */
  sourceText: string
  /** Per locale, the text the reviewer approved. */
  humanTextByLocale: ReadonlyMap<string, string>
  /** Locales rewritten wholesale — no term extracted from a rewrite is credible. */
  styleOnlyLocales: ReadonlySet<string>
}

export interface ParsedProposals {
  proposals: ModelProposal[]
  /** Rows the validation refused, for the claim document's audit line. */
  dropped: number
}

/**
 * The stable identity of a proposal: its kind, its subject term or rule, the
 * locale it is about, and the corrected form.
 *
 * Deterministic on purpose. Two runs that reach the same conclusion write the
 * same document and the second only bumps `occurrences` — which turns "the same
 * correction keeps happening" into a number a reviewer can sort by, at no
 * storage cost and with no duplicate to triage.
 */
export function proposalKey(proposal: {
  kind: ProposalKind
  locale: string
  rule?: string
  term?: string
  correctedForm?: string
}): string {
  const subject = proposal.term ?? proposal.rule ?? ''
  return [proposal.kind, subject, proposal.locale, proposal.correctedForm ?? ''].join('|')
}

/** `l10n.proposal.<16 hex>` — the published id. Proposals only ever exist as drafts of it. */
export function proposalId(key: string): string {
  return `${proposalTypeName}.${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}

/** The id a proposal is actually written at. */
export function proposalDraftId(key: string): string {
  return `drafts.${proposalId(key)}`
}

/**
 * Parse and validate the distillation response.
 *
 * Every row has to survive: a kind the model is allowed to propose, a configured
 * locale, a rationale, and — for a term — both halves quoted verbatim from text
 * this code has read. Anything else is dropped rather than repaired.
 */
export function parseProposalResponse(
  raw: string,
  context: ProposalValidationContext,
): ParsedProposals {
  const parsed: unknown = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim())
  if (!isRecord(parsed)) throw new Error('Distillation response was not a JSON object')
  if (!Array.isArray(parsed.proposals)) {
    throw new Error('Distillation response is missing proposals')
  }

  const proposals: ModelProposal[] = []
  const seen = new Set<string>()

  for (const row of parsed.proposals) {
    const proposal = validateRow(row, context)
    if (!proposal) continue

    const key = proposalKey({
      kind: proposal.kind,
      locale: proposal.locale,
      term: proposal.term,
      rule: proposal.rule,
      correctedForm: proposal.translation,
    })
    if (seen.has(key)) continue
    seen.add(key)
    proposals.push(proposal)
  }

  return {proposals, dropped: parsed.proposals.length - proposals.length}
}

function validateRow(row: unknown, context: ProposalValidationContext): ModelProposal | null {
  if (!isRecord(row)) return null
  // The hard prohibition, enforced where the value would enter the system rather
  // than only where it would leave it.
  if (row.doNotTranslate) return null

  const {fieldPath, kind, locale, rationale} = row
  if (!isModelKind(kind)) return null
  if (typeof locale !== 'string' || !context.locales.has(locale)) return null
  if (typeof rationale !== 'string' || !rationale.trim()) return null

  const base = {
    kind,
    locale,
    rationale: rationale.trim(),
    fieldPath: typeof fieldPath === 'string' ? fieldPath : '',
  }

  if (kind === 'style-rule') {
    const {rule} = row
    if (typeof rule !== 'string' || !rule.trim()) return null
    return {...base, rule: rule.trim()}
  }

  // A locale the human rewrote end to end tells us about register, not vocabulary.
  if (context.styleOnlyLocales.has(locale)) return null

  const {term, translation} = row
  if (typeof term !== 'string' || !term.trim()) return null
  if (typeof translation !== 'string' || !translation.trim()) return null
  if (!context.sourceText.includes(term.trim())) return null
  if (!(context.humanTextByLocale.get(locale) ?? '').includes(translation.trim())) return null

  return {...base, term: term.trim(), translation: translation.trim()}
}

function isModelKind(value: unknown): value is ModelProposalKind {
  return MODEL_PROPOSAL_KINDS.some((kind) => kind === value)
}

/** The document body a validated model proposal becomes. */
export function proposalDocumentFor(args: {
  proposal: ModelProposal
  evidence: ProposalEvidence
  run: string
  subjectId: string
}): ProposalDocument {
  const {evidence, proposal, run, subjectId} = args
  const key = proposalKey({
    kind: proposal.kind,
    locale: proposal.locale,
    term: proposal.term,
    rule: proposal.rule,
    correctedForm: proposal.translation,
  })

  return {
    _id: proposalDraftId(key),
    _type: proposalTypeName,
    kind: proposal.kind,
    locale: proposal.locale,
    rationale: proposal.rationale,
    occurrences: 0,
    run,
    subject: weakRef(subjectId),
    evidence,
    ...(proposal.term !== undefined && {term: proposal.term}),
    ...(proposal.translation !== undefined && {translation: proposal.translation}),
    ...(proposal.rule !== undefined && {rule: proposal.rule}),
  }
}

/**
 * An eval case, harvested rather than proposed.
 *
 * Coordinates only. Materializing a fixture means reading two revisions out of
 * the History API, which is a script's job, not a document's — and the
 * coordinates stay valid long after the text has moved on.
 */
export function evalCaseDocumentFor(args: {
  coordinates: EvalCaseCoordinates
  run: string
  subjectId: string
  rationale: string
}): ProposalDocument {
  const {coordinates, rationale, run, subjectId} = args
  const key = proposalKey({
    kind: 'eval-case',
    locale: coordinates.locale,
    term: coordinates.targetId,
    correctedForm: coordinates.targetRev,
  })

  return {
    _id: proposalDraftId(key),
    _type: proposalTypeName,
    kind: 'eval-case',
    locale: coordinates.locale,
    rationale,
    occurrences: 0,
    run,
    subject: weakRef(subjectId),
    coordinates,
  }
}

function weakRef(id: string): {_type: 'reference'; _ref: string; _weak: true} {
  return {_type: 'reference', _ref: id, _weak: true}
}
