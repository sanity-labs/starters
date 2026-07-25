import {gdrRef} from '@sanity/workflow-engine'
import {
  createBench,
  DEFAULT_WORKFLOW_RESOURCE,
  releaseField,
  subjectField,
} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {ANALYZE_SOURCE, PUBLISH_RELEASE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'
const DOCUMENT_IDS = ['article-1', 'article-2']

/**
 * The invariant the runtime is built on: **no instance of any definition ever
 * holds more than one pending effect**. That is what makes the drain Function's
 * serial, whole-instance drain worth at most one AI call per invocation, and why
 * nothing in this package needs a concurrency cap of its own.
 *
 * Concurrency still exists — a document with eight locales has eight AI calls in
 * flight — but it lives in eight separate instances, spread over eight drains,
 * which is the engine's fan-out rather than a semaphore anyone here wrote.
 */
function invariantCheck(bench: ReturnType<typeof createBench>, rootId: string) {
  return async function expectAtMostOnePendingEffect() {
    const overloaded: Record<string, string[]> = {}
    for (const instanceId of await instanceTree(bench, rootId)) {
      const pending = await bench.listPendingEffects({instanceId})
      if (pending.length > 1) overloaded[instanceId] = pending.map((effect) => effect.name)
    }
    expect(overloaded).toEqual({})
  }
}

/**
 * Every instance in the run tree, root first. Rooted rather than per-instance
 * because a campaign's AI calls live two hops down, in its grandchildren.
 */
async function instanceTree(
  bench: ReturnType<typeof createBench>,
  instanceId: string,
): Promise<string[]> {
  const ids = [instanceId]
  for (const child of await bench.children({instanceId})) {
    ids.push(...(await instanceTree(bench, child._id)))
  }
  return ids
}

async function newBench() {
  const bench = createBench({
    now: T0,
    documents: DOCUMENT_IDS.map((_id) => ({_id, _type: 'article', title: _id, language: 'en-US'})),
  })
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  return bench
}

async function startDocumentRun() {
  const bench = await newBench()
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  return {bench, instanceId: instance._id}
}

/** The `doc.refs` input the campaign fans out over; the bench ships no plural helper. */
function documentsField(documentIds: string[]) {
  return {
    type: 'doc.refs' as const,
    name: 'documents',
    value: documentIds.map((documentId) =>
      gdrRef({res: DEFAULT_WORKFLOW_RESOURCE, documentId, type: 'article'}),
    ),
  }
}

async function startCampaign() {
  const bench = await newBench()
  const {instance} = await bench.startInstance({
    definition: 'localize-campaign',
    initialFields: [releaseField('spring-launch'), documentsField(DOCUMENT_IDS)],
  })
  return {bench, instanceId: instance._id}
}

async function reportAnalysis(
  bench: ReturnType<typeof createBench>,
  instanceId: string,
  locales: string[],
  analyzedRev = 'rev-1',
) {
  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'analyzedRev'},
        value: {type: 'literal', value: analyzedRev},
      },
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'targetLocales'},
        value: {
          type: 'literal',
          value: locales.map((locale) => ({locale, reason: 'body changed'})),
        },
      },
    ],
  })
}

/**
 * Settles the locale runs still awaiting a translation, checking the invariant
 * on either side of every completion: a half-settled cohort is exactly where a
 * definition that re-queued work per completion would show a second effect.
 */
async function settleCohort(
  bench: ReturnType<typeof createBench>,
  instanceId: string,
  check: ReturnType<typeof invariantCheck>,
  status: 'done' | 'failed' = 'done',
) {
  for (const child of await bench.children({instanceId})) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await check()
    await bench.completePendingEffect({instanceId: child._id, effect: TRANSLATE_LOCALE, status})
    await check()
  }
}

test('a document run holds one pending effect at a time from analysis to approval', async () => {
  const {bench, instanceId} = await startDocumentRun()
  const check = invariantCheck(bench, instanceId)

  expect(await bench.currentStage(instanceId)).toBe('analyzing')
  await check()

  await reportAnalysis(bench, instanceId, ['de-DE', 'fr-FR', 'ja-JP'])
  await check()
  expect(await bench.currentStage(instanceId)).toBe('translating')

  // The fan-out is where a hand-rolled pipeline would have queued three calls
  // against one worker. Here the parent holds none and each child holds its own.
  expect(await bench.listPendingEffects({instanceId})).toEqual([])
  const cohort = await bench.children({instanceId})
  for (const child of cohort) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    expect(pending.map((effect) => effect.name)).toEqual([TRANSLATE_LOCALE])
  }

  await settleCohort(bench, instanceId, check)
  expect(await bench.currentStage(instanceId)).toBe('review')

  const {instance} = await bench.fireAction({instanceId, activity: 'review', action: 'approve'})
  expect(instance.currentStage).toBe('approved')
  await check()
  expect(await bench.listPendingEffects({instanceId})).toEqual([])
})

test('the redo loops re-arm an effect rather than stacking a second one', async () => {
  const {bench, instanceId} = await startDocumentRun()
  const check = invariantCheck(bench, instanceId)
  await reportAnalysis(bench, instanceId, ['de-DE', 'fr-FR'])

  // One locale fails, so review is reached on a partial cohort.
  const [first, second] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: first._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })
  await check()
  await bench.completePendingEffect({
    instanceId: second._id,
    effect: TRANSLATE_LOCALE,
    status: 'failed',
  })
  await check()
  expect(await bench.currentStage(instanceId)).toBe('review')

  // The retry path. Re-entering `translating` spawns a fresh run for the failed
  // locale; the settled runs of the first visit are still in the tree, and stay
  // empty rather than being re-armed alongside it.
  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'retry fr-FR', locales: [{locale: 'fr-FR', reason: 'reviewer'}]},
  })
  await check()
  expect(await bench.currentStage(instanceId)).toBe('translating')
  await settleCohort(bench, instanceId, check)
  expect(await bench.currentStage(instanceId)).toBe('review')

  // Source drift is observed by a tick, which re-evaluates every trigger in the
  // open stage — and queues nothing, because review has no effects.
  await bench.editDocument({documentId: 'article-1', patch: {set: {title: 'Retitled'}}})
  await bench.tick({instanceId})
  await check()

  // Re-entry into `analyzing` is a second visit to a stage whose trigger already
  // fired once. It arms exactly one analysis, not one per visit.
  await bench.fireAction({instanceId, activity: 'review', action: 'refresh-from-source'})
  await check()
  const requeued = await bench.listPendingEffects({instanceId})
  expect(requeued.map((effect) => effect.name)).toEqual([ANALYZE_SOURCE])

  await reportAnalysis(bench, instanceId, ['de-DE'], 'rev-2')
  await check()
  await settleCohort(bench, instanceId, check)
  const {instance} = await bench.fireAction({instanceId, activity: 'review', action: 'approve'})
  expect(instance.currentStage).toBe('approved')
  await check()
})

test('a run that needs no work leaves nothing queued behind it', async () => {
  const {bench, instanceId} = await startDocumentRun()
  const check = invariantCheck(bench, instanceId)

  await reportAnalysis(bench, instanceId, [])
  await check()

  expect(await bench.currentStage(instanceId)).toBe('done')
  expect(await bench.listPendingEffects({instanceId})).toEqual([])
})

test('a failed analysis leaves nothing queued behind it', async () => {
  const {bench, instanceId} = await startDocumentRun()
  const check = invariantCheck(bench, instanceId)

  await bench.completePendingEffect({instanceId, effect: ANALYZE_SOURCE, status: 'failed'})
  await check()

  // Terminal, and the failed effect is settled rather than left claimable — a
  // parked-but-pending effect would be drained again on every invocation.
  expect(await bench.currentStage(instanceId)).toBe('failed')
  expect(await bench.listPendingEffects({instanceId})).toEqual([])
})

test('a campaign holds one pending effect at a time, publish retry included', async () => {
  const {bench, instanceId} = await startCampaign()
  const check = invariantCheck(bench, instanceId)

  // A campaign fans out by spawning, never by queueing: the AI calls of a
  // two-document, four-locale batch are spread over six instances.
  await check()
  expect(await bench.listPendingEffects({instanceId})).toEqual([])

  for (const document of await bench.children({instanceId})) {
    await reportAnalysis(bench, document._id, ['de-DE', 'fr-FR'])
    await check()
    await settleCohort(bench, document._id, check)
    await bench.fireAction({instanceId: document._id, activity: 'review', action: 'approve'})
    await check()
  }
  expect(await bench.currentStage(instanceId)).toBe('ready')

  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})
  await check()
  const queued = await bench.listPendingEffects({instanceId})
  expect(queued.map((effect) => effect.name)).toEqual([PUBLISH_RELEASE])

  // The publish retry is the one loop-back that re-enters a stage to re-arm an
  // effect. The failed attempt has to be gone before the fresh one is queued, or
  // a retried campaign would drain two publishes.
  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'failed'})
  await check()
  expect(await bench.currentStage(instanceId)).toBe('ready')
  expect(await bench.listPendingEffects({instanceId})).toEqual([])

  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})
  await check()
  const retried = await bench.listPendingEffects({instanceId})
  expect(retried.map((effect) => effect.name)).toEqual([PUBLISH_RELEASE])

  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'done'})
  await check()
  expect(await bench.currentStage(instanceId)).toBe('published')
  expect(await bench.listPendingEffects({instanceId})).toEqual([])
})
