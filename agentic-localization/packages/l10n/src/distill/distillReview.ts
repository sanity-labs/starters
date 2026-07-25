/**
 * The learning loop: what an approved run taught, written back as drafts.
 *
 * Claim, gather, diff, gate, ask, propose — in that order, and the order is the
 * design:
 *
 * - **Claim first.** The claim document is both the idempotency key and the audit
 *   record. A throw before it leaves no trace of the run ever having been looked
 *   at, and Sanity Functions' retry semantics are undocumented — so the record
 *   exists before anything that can fail.
 * - **Gate before spend.** `computeDistillDelta` is pure and runs on every
 *   approved run; the AI call runs only when there is signal. A reviewer who
 *   fixed a comma costs nothing.
 * - **Propose, never decide.** Output is `drafts.l10n.proposal.*`. Prompt
 *   assembly reads only published, `approved`-status context, so two human acts
 *   stand between this code and a prompt.
 *
 * The whole loop is one directory plus one Function, deliberately: deleting it is
 * `rm -r src/distill functions/distill-review` and one blueprint resource.
 */

import {createHash} from 'node:crypto'

import type {DistillDelta, DistillDeltaInput, LocaleDelta} from '../core/distillDelta'
import type {DistillClient, DistillEngine, GatheredLocale, GatheredRun} from './gather'
import type {ModelProposal, ProposalDocument, ProposalEvidence} from './proposals'

import {computeDistillDelta, distillText, normalizeText} from '../core/distillDelta'
import {distillationTypeName} from '../core/typeNames'
import {LOCALE_CODES_QUERY} from '../prompts/queries'
import {SOURCE_LANGUAGE} from '../workflows/effects'
import {gatherRun, silent} from './gather'
import {buildDistillPrompt} from './prompt'
import {
  evalCaseDocumentFor,
  parseProposalResponse,
  proposalDocumentFor,
  type EvalCaseCoordinates,
} from './proposals'

/**
 * How long a claim document is kept.
 *
 * Long enough to answer "did this run get distilled, and what came of it", short
 * enough that the dataset does not accumulate one document per approval forever.
 * Swept by the loop's own Function rather than a second scheduled one — the sweep
 * is a single prefix-and-date delete, which does not warrant a deployment.
 */
export const CLAIM_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Why nothing was proposed. Everything but `null` is a normal outcome. */
export type DistillOutcome =
  | 'already-claimed'
  | 'distilled'
  | 'no-proposals'
  | DistillDelta['skipReason']
  | GatheredRun['skipReason']

export interface DistillReviewResult {
  outcome: DistillOutcome
  claimId: string
  /** AI calls spent. At most one, for the whole run. */
  aiSpent: number
  /** Proposal drafts written, model-derived and harvested together. */
  proposals: number
  locales: string[]
  /** The source document the run localized, once the gather has found it. */
  subjectId?: string
}

export interface DistillReviewArgs {
  /** Addresses the CONTENT dataset: claims, proposals and the text live there. */
  client: DistillClient
  /** The content dataset's name — the History API takes it in the path. */
  dataset: string
  engine: DistillEngine
  instanceId: string
  log?: (message: string) => void
  now?: () => Date
}

/** `l10n.distillation.<16 hex of the instance id>` — one per run, forever. */
export function claimId(instanceId: string): string {
  const digest = createHash('sha256').update(instanceId).digest('hex').slice(0, 16)
  return `${distillationTypeName}.${digest}`
}

export async function distillReview(args: DistillReviewArgs): Promise<DistillReviewResult> {
  const {client, dataset, engine, instanceId} = args
  const log = args.log ?? silent
  const now = args.now ?? (() => new Date())

  await sweepClaims(client, now())

  const id = claimId(instanceId)
  if (!(await claim(client, {id, instanceId, at: now()}))) {
    log(`${instanceId} already distilled (${id})`)
    return {outcome: 'already-claimed', claimId: id, aiSpent: 0, proposals: 0, locales: []}
  }

  try {
    const result = await distil({client, dataset, engine, instanceId, log})
    await settleClaim(client, id, {
      at: now(),
      status: 'done',
      outcome: result.outcome,
      aiSpent: result.aiSpent,
      proposals: result.proposals,
      locales: result.locales,
      subjectId: result.subjectId,
    })
    log(
      `${instanceId}: ${result.outcome}, ${result.proposals} proposal(s), ${result.aiSpent} AI call(s)`,
    )
    return {...result, claimId: id}
  } catch (error) {
    // The claim exists, so the failure is recorded rather than invisible — and a
    // redelivery short-circuits on it instead of retrying the same broken read.
    await settleClaim(client, id, {
      at: now(),
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/** The pipeline proper, with the claim already held. */
async function distil(args: {
  client: DistillClient
  dataset: string
  engine: DistillEngine
  instanceId: string
  log: (message: string) => void
}): Promise<Omit<DistillReviewResult, 'claimId'>> {
  const {client, dataset, engine, instanceId, log} = args

  const run = await gatherRun({client, dataset, engine, instanceId, log})
  if (run.skipReason) {
    return {
      outcome: run.skipReason,
      aiSpent: 0,
      proposals: 0,
      locales: [],
      ...(run.subjectId && {subjectId: run.subjectId}),
    }
  }

  const locales = run.locales.map((locale) => locale.locale)
  const delta = computeDistillDelta(deltaInputs(run.locales), {
    sourceChangedFields: run.sourceChangedFields,
  })

  // Harvested, not proposed, and free: a locale the reviewer did not touch is a
  // machine translation a human signed off verbatim.
  const documents: ProposalDocument[] = evalCases(run, delta.cleanLocales)

  let aiSpent = 0
  if (delta.skipReason) {
    log(`${instanceId}: ${delta.skipReason} — no AI call`)
  } else {
    aiSpent = 1
    documents.push(...(await proposeFrom({client, delta, run, log})))
  }

  await writeProposals(client, documents)

  return {
    outcome: delta.skipReason ?? (documents.length > 0 ? 'distilled' : 'no-proposals'),
    aiSpent,
    proposals: documents.length,
    locales,
    subjectId: run.subjectId,
  }
}

/** The pair the gate compares, per locale. */
function deltaInputs(locales: readonly GatheredLocale[]): DistillDeltaInput[] {
  return locales.map((locale) => ({
    locale: locale.locale,
    machine: locale.machine,
    human: locale.human,
  }))
}

async function proposeFrom(args: {
  client: DistillClient
  delta: DistillDelta
  log: (message: string) => void
  run: GatheredRun
}): Promise<ProposalDocument[]> {
  const {client, delta, log, run} = args

  const codes = await client.fetch<string[]>(
    LOCALE_CODES_QUERY,
    {},
    {perspective: 'published', tag: 'distill-locales'},
  )

  const response = await client.agent.action.prompt({
    instruction: buildDistillPrompt({
      locales: delta.locales,
      sourceText: run.sourceText,
      sourceLanguage: SOURCE_LANGUAGE,
    }),
  })

  const {dropped, proposals} = parseProposalResponse(response, {
    locales: new Set(codes),
    sourceText: run.sourceText,
    humanTextByLocale: humanTextByLocale(delta.locales),
    styleOnlyLocales: new Set(
      delta.locales.filter((locale) => locale.styleOnly).map((locale) => locale.locale),
    ),
  })
  if (dropped > 0) log(`${run.instanceId}: dropped ${dropped} unverifiable proposal(s)`)

  return proposals.map((proposal) =>
    proposalDocumentFor({
      proposal,
      evidence: evidenceFor(proposal, delta.locales, run),
      run: run.instanceId,
      subjectId: run.subjectId,
    }),
  )
}

/**
 * Everything the reviewer approved for a locale, as one string.
 *
 * The verbatim check needs a haystack, and a per-field one would reject a term
 * the model quoted from the right locale but attributed to the wrong field.
 */
function humanTextByLocale(locales: readonly LocaleDelta[]): Map<string, string> {
  return new Map(
    locales.map((locale) => [locale.locale, locale.spans.map((span) => span.humanText).join('\n')]),
  )
}

/** The span the proposal is about, or the locale's first — never nothing. */
function evidenceFor(
  proposal: ModelProposal,
  locales: readonly LocaleDelta[],
  run: GatheredRun,
): ProposalEvidence {
  const locale = locales.find((entry) => entry.locale === proposal.locale)
  const span =
    locale?.spans.find((entry) => entry.fieldPath === proposal.fieldPath) ?? locale?.spans[0]

  const fieldPath = span?.fieldPath ?? proposal.fieldPath
  return {
    fieldPath,
    sourceExcerpt: normalizeText(distillText(run.sourceFields[fieldPath])),
    machineText: span?.machineText ?? '',
    humanText: span?.humanText ?? '',
  }
}

/**
 * One eval case per locale the reviewer left alone.
 *
 * Coordinates only — `{locale, targetId, targetRev, sourceRev}` — because a
 * fixture materialized now would go stale while the coordinates stay valid. A
 * locale whose machine draft was only reachable by timestamp is skipped: a case
 * a script cannot resolve is not a case.
 */
function evalCases(run: GatheredRun, cleanLocales: readonly string[]): ProposalDocument[] {
  const clean = new Set(cleanLocales)
  return run.locales.flatMap((locale) => {
    if (!clean.has(locale.locale) || !locale.machineRev) return []
    return [
      evalCaseDocumentFor({
        coordinates: coordinatesFor(locale, locale.machineRev, run.sourceRev),
        run: run.instanceId,
        subjectId: run.subjectId,
        rationale: `A reviewer approved the ${locale.locale} machine translation with no edits.`,
      }),
    ]
  })
}

function coordinatesFor(
  locale: GatheredLocale,
  targetRev: string,
  sourceRev: string,
): EvalCaseCoordinates {
  return {locale: locale.locale, targetId: locale.targetId, targetRev, sourceRev}
}

/**
 * Write every proposal as a draft, collapsing repeats onto `occurrences`.
 *
 * `createIfNotExists` then `inc`: the id is a hash of what the proposal SAYS, so
 * two runs reaching the same conclusion write one document whose count is the
 * number of times a human has now made the same correction — which is the signal
 * a reviewer should be sorting by. The evidence stays from the first sighting;
 * it is the audit of when the pattern was first seen, and the count says the
 * rest.
 */
async function writeProposals(
  client: DistillClient,
  documents: readonly ProposalDocument[],
): Promise<void> {
  if (documents.length === 0) return

  const transaction = client.transaction()
  for (const document of documents) {
    transaction.createIfNotExists(document)
    transaction.patch(document._id, {inc: {occurrences: 1}})
  }
  await transaction.commit({autoGenerateArrayKeys: true, tag: 'write-proposals'})
}

/**
 * Take the run, or find it already taken.
 *
 * `create` at a deterministic id is the whole mechanism — the same shape
 * `start-localization` uses for its own idempotency key. A 409 means another
 * delivery of this event got here first.
 */
async function claim(
  client: DistillClient,
  args: {id: string; instanceId: string; at: Date},
): Promise<boolean> {
  try {
    await client.create(
      {
        _id: args.id,
        _type: distillationTypeName,
        run: args.instanceId,
        status: 'claimed',
        startedAt: args.at.toISOString(),
      },
      {tag: 'claim-distillation'},
    )
    return true
  } catch (error) {
    if (isConflict(error)) return false
    throw error
  }
}

/**
 * Everything the run turned out to be, on the document that claimed it.
 *
 * `outcome` is always written; `skipReason` only when nothing was asked of a
 * model, so "why did this run cost nothing" is one field read rather than a
 * comparison of two.
 */
async function settleClaim(
  client: DistillClient,
  id: string,
  args: {
    at: Date
    status: 'done' | 'failed'
    outcome?: DistillOutcome
    detail?: string
    aiSpent?: number
    proposals?: number
    locales?: string[]
    subjectId?: string
  },
): Promise<void> {
  const skipped = args.outcome !== undefined && args.outcome !== 'distilled' && !args.aiSpent

  await client
    .transaction()
    .patch(id, {
      set: {
        status: args.status,
        completedAt: args.at.toISOString(),
        ...(args.outcome !== undefined && {outcome: args.outcome}),
        ...(skipped && {skipReason: args.outcome}),
        ...(args.detail !== undefined && {detail: args.detail}),
        ...(args.aiSpent !== undefined && {aiSpent: args.aiSpent}),
        ...(args.proposals !== undefined && {proposals: args.proposals}),
        ...(args.locales !== undefined && {locales: args.locales}),
        ...(args.subjectId && {
          subject: {_type: 'reference', _ref: args.subjectId, _weak: true},
        }),
      },
    })
    .commit({tag: 'settle-distillation'})
}

/** Claim documents past the retention window. One query, at the front of the run. */
async function sweepClaims(client: DistillClient, now: Date): Promise<void> {
  await client.delete(
    {
      query: '*[string::startsWith(_id, $prefix) && _updatedAt < $cutoff]',
      params: {
        prefix: `${distillationTypeName}.`,
        cutoff: new Date(now.getTime() - CLAIM_RETENTION_MS).toISOString(),
      },
    },
    {tag: 'sweep-distillations'},
  )
}

/** Structural, not `instanceof`: a bundled second copy of `@sanity/client` breaks the class check. */
function isConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if (!('statusCode' in error)) return false
  return error.statusCode === 409
}
