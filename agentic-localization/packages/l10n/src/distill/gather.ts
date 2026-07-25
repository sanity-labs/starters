/**
 * What an approved run left behind, read back as text pairs.
 *
 * Everything here is reconstruction, and every read has a reason it is the read
 * it is:
 *
 * - **The machine side** comes from the History API at the child's `machineRev`.
 *   That revision is the one moment machine output is unambiguous — the next
 *   writer is the reviewer. There is no `ranAt + durationMs` bracketing: the
 *   engine records `ranAt` at completion and never records `durationMs`, so the
 *   timestamp fallback is `?time=<ranAt>`, not an interval.
 * - **The human side** is the layer the run actually wrote into: a draft for a
 *   standalone run, a `versions.<release>.<id>` document for a campaign child.
 *   A literal draft or version id only resolves under `perspective: 'raw'`.
 * - **The tiers differ in shape, not in kind.** A document-tier target is its
 *   own document, so the pair is two whole documents. A field-tier target IS the
 *   subject, so both sides are reduced to that locale's entries first — the same
 *   `sourceProjection` reduction the analysis uses to keep a run from seeing its
 *   own output as a source edit.
 *
 * Degrade, never guess. A revision outside the retention window drops its locale
 * rather than inventing a comparison.
 */

import type {Engine, WorkflowInstance} from '@sanity/workflow-engine'

import {DEFAULT_CONTENT_PERSPECTIVE} from '@sanity/workflow-engine'
import {DocumentId, getDraftId, getVersionId} from '@sanity/id-utils'

import type {InternationalizedField} from '../core/fieldTier'

import {computeFieldChanges} from '../core/computeFieldChanges'
import {documentAtRevision, documentAtTime} from '../core/documentHistory'
import {internationalizedFields, sourceProjection} from '../core/fieldTier'
import {
  readDocumentId,
  readFlag,
  readLocaleRequests,
  readReleaseName,
  readText,
} from '../core/instanceFields'
import {buildLocaleRuns, childInstanceIds, toChildRun} from '../core/localeRuns'
import {extractDocumentText} from '../prompts/promptAssembly'
import {SOURCE_LANGUAGE} from '../workflows/config'
import {TRANSLATE_LOCALE} from '../workflows/effects'

/**
 * The `@sanity/client` slice the loop uses. Narrow deliberately: a spec stands
 * one of these up in a few lines, which is what makes the gather paths per tier
 * testable without a project.
 */
export interface DistillClient {
  fetch: <T>(
    query: string,
    params?: Record<string, unknown>,
    options?: {perspective?: string | string[]; tag?: string},
  ) => Promise<T>
  request: <T>(options: {url: string; tag?: string}) => Promise<T>
  create: <T extends {_id: string; _type: string}>(
    document: T,
    options?: {tag?: string},
  ) => Promise<unknown>
  delete: (
    selection: {query: string; params?: Record<string, unknown>},
    options?: {tag?: string},
  ) => Promise<unknown>
  transaction: () => DistillTransaction
  agent: {action: {prompt: (params: {instruction: string}) => Promise<string>}}
}

/**
 * Patches are written in the object form rather than through a builder: the
 * builder's type is the concrete `Patch` class, which nothing but the real client
 * can produce — and a spec has to be able to.
 */
export interface DistillPatchOperations {
  set?: Record<string, unknown>
  setIfMissing?: Record<string, unknown>
  inc?: Record<string, number>
}

export interface DistillTransaction {
  createIfNotExists: <T extends {_id: string; _type: string}>(document: T) => DistillTransaction
  patch: (id: string, operations: DistillPatchOperations) => DistillTransaction
  commit: (options?: {autoGenerateArrayKeys?: boolean; tag?: string}) => Promise<unknown>
}

/** The engine verbs the loop reads instances through. Satisfied by a real `Engine`. */
export type DistillEngine = Pick<Engine, 'children' | 'getInstance'>

export type GatherSkipReason =
  | 'history-unavailable'
  | 'no-subject'
  | 'no-translated-locales'
  | 'source-drift'

/** One locale's machine draft and the text a human approved in its place. */
export interface GatheredLocale {
  locale: string
  childInstanceId: string
  /** The literal id the machine revision belongs to — a draft or a release version. */
  targetId: string
  targetPublishedId: string
  /** Absent when the child's write was a no-op and the read fell back to `?time=`. */
  machineRev: null | string
  machine: Record<string, unknown>
  human: Record<string, unknown>
}

export interface GatheredRun {
  instanceId: string
  subjectId: string
  subjectType: string
  /** The source revision the run analyzed — an eval case's third coordinate. */
  sourceRev: string
  sourceText: string
  /** The source, keyed the same way the two compared sides are, for evidence. */
  sourceFields: Record<string, unknown>
  /** Fields the SOURCE moved since the analysis: their target text moved for that reason. */
  sourceChangedFields: string[]
  locales: GatheredLocale[]
  skipReason: GatherSkipReason | null
}

/** The default logger. Narration is opt-in; a caller that wants it passes one. */
export const silent: (message: string) => void = () => undefined

export interface GatherArgs {
  client: DistillClient
  /** The dataset content lives in — the History API takes it in the path. */
  dataset: string
  engine: DistillEngine
  instanceId: string
  log?: (message: string) => void
}

export async function gatherRun(args: GatherArgs): Promise<GatheredRun> {
  const {client, dataset, engine, instanceId} = args
  const log = args.log ?? silent

  const instance = await engine.getInstance({instanceId})
  const subjectId = readDocumentId(instance, 'subject')
  const release = readReleaseName(instance, 'release')
  const perspective = instance.perspective ?? DEFAULT_CONTENT_PERSPECTIVE

  if (!subjectId) return empty(instanceId, 'no-subject')

  // The subject as the engine saw it — the same read `readSubjectDocument` makes,
  // for the same reason: `analyzedRev` is a revision of THIS layer.
  const sourceDoc = await client.fetch<null | Record<string, unknown>>(
    `*[_id == $id][0]`,
    {id: subjectId},
    {perspective, tag: 'distill-source'},
  )
  if (!sourceDoc) return empty(instanceId, 'no-subject')

  const subjectType = typeof sourceDoc._type === 'string' ? sourceDoc._type : ''
  const fields = internationalizedFields(subjectType)
  const project = projectionFor(fields)
  const sourceFields =
    fields.length > 0 ? sourceProjection(sourceDoc, fields, SOURCE_LANGUAGE) : sourceDoc

  const analyzedRev = readText(instance, 'analyzedRev')
  const currentRev = typeof sourceDoc._rev === 'string' ? sourceDoc._rev : ''
  const sourceReadId = typeof sourceDoc._originalId === 'string' ? sourceDoc._originalId : subjectId

  // The engine already knows whether the source moved. Only when it says so is
  // there anything to work out — and if the old revision is unreadable we cannot
  // tell a human's correction from a translation of newer English, so we stop.
  let sourceChangedFields: string[] = []
  if (readFlag(instance, 'sourceChanged') && analyzedRev) {
    const historical = await notFoundAsNull(() =>
      documentAtRevision(client, {
        dataset,
        documentId: sourceReadId,
        revision: analyzedRev,
      }),
    )
    if (!historical) {
      log(`source drift on ${instanceId} and revision ${analyzedRev} is unreadable`)
      return empty(instanceId, 'source-drift')
    }
    sourceChangedFields = computeFieldChanges(project(historical), project(sourceDoc))
      .filter((change) => change.changed)
      .map((change) => change.fieldName)
  }

  const runs = await translatedLocales(engine, instance)
  const locales: GatheredLocale[] = []

  for (const run of runs) {
    const targetPublishedId = run.targetDocumentId
    const targetId = writtenId(targetPublishedId, release)

    const machine = await machineDraft(client, {dataset, documentId: targetId, run})
    if (!machine) {
      log(`${run.locale}: the machine draft of ${targetId} is unreadable`)
      continue
    }

    const human = await readHumanLayer(client, {release, targetId, targetPublishedId})
    if (!human) {
      log(`${run.locale}: no approved text at ${targetId}`)
      continue
    }

    locales.push({
      locale: run.locale,
      childInstanceId: run.childInstanceId,
      targetId,
      targetPublishedId,
      machineRev: run.machineRev,
      machine: fields.length > 0 ? sourceProjection(machine, fields, run.locale) : machine,
      human: fields.length > 0 ? sourceProjection(human, fields, run.locale) : human,
    })
  }

  return {
    instanceId,
    subjectId,
    subjectType,
    sourceRev: analyzedRev ?? currentRev,
    sourceText: extractDocumentText(sourceFields),
    sourceFields,
    sourceChangedFields,
    locales,
    skipReason: skipReasonFor(runs.length, locales.length),
  }
}

function skipReasonFor(requested: number, gathered: number): GatherSkipReason | null {
  if (requested === 0) return 'no-translated-locales'
  if (gathered === 0) return 'history-unavailable'
  return null
}

/** One locale's translated child, and the two ways to find what it wrote. */
interface TranslatedLocale {
  locale: string
  childInstanceId: string
  targetDocumentId: string
  machineRev: null | string
  /** The translate effect's completion instant — the `?time=` fallback. */
  ranAt: null | string
}

/**
 * Every locale whose newest attempt translated, with the revision it wrote.
 *
 * `buildLocaleRuns` owns the two engine facts that make this non-obvious:
 * subworkflow rows accumulate across stage visits, so a retried locale has one
 * row per attempt and only the newest describes the run; and a row's
 * `resolved.stage` is the outcome — cohort `status` only says it settled.
 *
 * `ranAt` comes off the child instance the engine already handed back, so the
 * fallback costs no extra read.
 */
async function translatedLocales(
  engine: DistillEngine,
  instance: WorkflowInstance,
): Promise<TranslatedLocale[]> {
  const subworkflows = instance.subworkflows ?? []
  if (childInstanceIds(subworkflows).length === 0) return []

  const instances = await engine.children({instanceId: instance._id})
  const ranAtById = new Map(instances.map((child) => [child._id, translateRanAt(child)]))
  const runs = buildLocaleRuns({
    targetLocales: readLocaleRequests(instance, 'targetLocales'),
    subworkflows,
    children: instances.map(toChildRun),
  })

  return runs.flatMap((run) => {
    if (run.stage !== 'translated') return []
    if (!run.childInstanceId || !run.targetDocumentId) return []
    const ranAt = ranAtById.get(run.childInstanceId) ?? null
    // Neither coordinate: nothing to read the machine output back by.
    if (!run.machineRev && !ranAt) return []
    return [
      {
        locale: run.locale,
        childInstanceId: run.childInstanceId,
        targetDocumentId: run.targetDocumentId,
        machineRev: run.machineRev,
        ranAt,
      },
    ]
  })
}

/** When the child's translation settled. Newest wins: a retry ran later. */
function translateRanAt(child: WorkflowInstance): null | string {
  const rows = (child.effectHistory ?? []).filter(
    (entry) => entry.name === TRANSLATE_LOCALE && entry.status === 'done',
  )
  const latest = rows.map((entry) => entry.ranAt).sort()[rows.length - 1]
  return typeof latest === 'string' && latest ? latest : null
}

/**
 * The machine output, by revision if the child recorded one and by instant if it
 * did not.
 *
 * `machineRev` is absent exactly when the write was a no-op — a redelivered
 * effect that found the release version it had already created gets back a
 * transaction id for a commit it did not make, so the handler records nothing.
 * The effect's own `ranAt` still pins the moment the output existed.
 */
async function machineDraft(
  client: DistillClient,
  args: {dataset: string; documentId: string; run: TranslatedLocale},
): Promise<null | Record<string, unknown>> {
  const {dataset, documentId, run} = args
  if (run.machineRev) {
    const atRevision = await notFoundAsNull(() =>
      documentAtRevision(client, {dataset, documentId, revision: run.machineRev!}),
    )
    if (atRevision) return atRevision
  }
  if (!run.ranAt) return null
  return notFoundAsNull(() => documentAtTime(client, {dataset, documentId, time: run.ranAt!}))
}

/** The layer the run wrote into: a release version when scoped to one, else the draft. */
function writtenId(publishedId: string, release: null | string): string {
  const id = DocumentId(publishedId)
  return release ? getVersionId(id, release) : getDraftId(id)
}

/**
 * The text a human approved.
 *
 * A release-scoped run's approved text is the version document, read `raw`
 * because a literal `versions.<release>.<id>` never matches under a resolving
 * perspective. A standalone run's is the draft if one still exists and the
 * published document once it has shipped — which is exactly what the `drafts`
 * perspective resolves to.
 */
async function readHumanLayer(
  client: DistillClient,
  args: {release: null | string; targetId: string; targetPublishedId: string},
): Promise<null | Record<string, unknown>> {
  if (args.release) {
    return client.fetch<null | Record<string, unknown>>(
      `*[_id == $id][0]`,
      {id: args.targetId},
      {perspective: 'raw', tag: 'distill-human-version'},
    )
  }
  return client.fetch<null | Record<string, unknown>>(
    `*[_id == $id][0]`,
    {id: args.targetPublishedId},
    {perspective: 'drafts', tag: 'distill-human-draft'},
  )
}

/** What two revisions of the subject are compared as — the analysis's own rule. */
function projectionFor(
  fields: InternationalizedField[],
): (document: Record<string, unknown>) => Record<string, unknown> {
  if (fields.length === 0) return (document) => document
  return (document) => sourceProjection(document, fields, SOURCE_LANGUAGE)
}

/**
 * A revision outside the retention window is a 404, and a 404 is an answer here
 * rather than an error — the run predates what the dataset still remembers.
 *
 * Narrowly 404: swallowing everything would report a bad token or a broken
 * endpoint as "nothing to learn", which is the kind of silence that makes a loop
 * look healthy while it does nothing.
 */
async function notFoundAsNull(
  read: () => Promise<null | Record<string, unknown>>,
): Promise<null | Record<string, unknown>> {
  try {
    return await read()
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return false
  return error.statusCode === 404
}

function empty(instanceId: string, skipReason: GatherSkipReason): GatheredRun {
  return {
    instanceId,
    subjectId: '',
    subjectType: '',
    sourceRev: '',
    sourceText: '',
    sourceFields: {},
    sourceChangedFields: [],
    locales: [],
    skipReason,
  }
}
