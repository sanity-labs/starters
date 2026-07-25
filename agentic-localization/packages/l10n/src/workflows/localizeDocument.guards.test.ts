import {MutationGuardDeniedError} from '@sanity/workflow-engine'
import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {startPerspectiveFor} from '../core/fieldTier'
import {ANALYZE_SOURCE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

const PUBLISHED = {
  _id: 'article-1',
  _type: 'article',
  title: 'Source',
  body: 'Body',
  language: 'en-US',
}
// `publish` promotes an existing draft onto the published id, so the store needs
// one for the action to be a legitimate write the guard can then vet.
const DRAFT = {...PUBLISHED, _id: 'drafts.article-1', title: 'Source, edited'}

function newBench() {
  return createBench({now: T0, documents: [PUBLISHED, DRAFT]})
}

async function startRun(bench: ReturnType<typeof newBench>) {
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  return instance._id
}

async function reportAnalysis(
  bench: ReturnType<typeof newBench>,
  instanceId: string,
  locales: string[],
) {
  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'analyzedRev'},
        value: {type: 'literal', value: 'rev-1'},
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

async function settleChildren(bench: ReturnType<typeof newBench>, instanceId: string) {
  for (const child of await bench.children({instanceId})) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
    })
  }
}

async function runInReview() {
  const bench = newBench()
  const instanceId = await startRun(bench)
  await reportAnalysis(bench, instanceId, ['de-DE'])
  await settleChildren(bench, instanceId)
  return {bench, instanceId}
}

async function guardNames(bench: ReturnType<typeof newBench>, instanceId: string) {
  return (await bench.guardsForInstance(instanceId)).map((guard) => guard.name)
}

test('nothing is held before review is reached', async () => {
  const bench = newBench()
  const instanceId = await startRun(bench)

  expect(await bench.currentStage(instanceId)).toBe('analyzing')
  expect(await guardNames(bench, instanceId)).toEqual([])
})

test('review holds publishing of the source', async () => {
  const {bench, instanceId} = await runInReview()
  expect(await bench.currentStage(instanceId)).toBe('review')

  expect(await guardNames(bench, instanceId)).toEqual(['hold-source-publish-during-review'])
  await expect(bench.editDocument({documentId: 'article-1', action: 'publish'})).rejects.toThrow(
    MutationGuardDeniedError,
  )
})

test('the hold covers publishing only, so the source can still be edited', async () => {
  const {bench} = await runInReview()

  // Editing has to stay open: `source-changed` reports drift to the reviewer
  // rather than preventing it, so denying updates would contradict that.
  const updated = await bench.editDocument({
    documentId: 'article-1',
    patch: {set: {title: 'Retitled during review'}},
  })
  expect(updated?.title).toBe('Retitled during review')
})

test('approving releases the hold', async () => {
  const {bench, instanceId} = await runInReview()

  await bench.fireAction({instanceId, activity: 'review', action: 'approve'})

  expect(await bench.currentStage(instanceId)).toBe('approved')
  expect(await guardNames(bench, instanceId)).toEqual([])
  await bench.editDocument({documentId: 'article-1', action: 'publish'})
})

test('requesting changes hands the hold back to translating', async () => {
  const {bench, instanceId} = await runInReview()

  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'Redo it', locales: [{locale: 'de-DE', reason: 'reviewer'}]},
  })

  // The review guard's document is physically deleted when its stage exits;
  // the translating stage's own hold takes over, so the source is never
  // publishable between the two.
  expect(await bench.currentStage(instanceId)).toBe('translating')
  expect(await guardNames(bench, instanceId)).toEqual(['hold-source-publish-during-translation'])

  await settleChildren(bench, instanceId)

  expect(await bench.currentStage(instanceId)).toBe('review')
  expect(await guardNames(bench, instanceId)).toEqual(['hold-source-publish-during-review'])
})

test('translating holds publishing of the source', async () => {
  const bench = newBench()
  const instanceId = await startRun(bench)
  await reportAnalysis(bench, instanceId, ['de-DE', 'fr-FR'])

  // The field tier's children write into the subject itself, so publishing
  // mid-fan-out would ship a half-translated document.
  expect(await bench.currentStage(instanceId)).toBe('translating')
  expect(await guardNames(bench, instanceId)).toEqual(['hold-source-publish-during-translation'])
  await expect(bench.editDocument({documentId: 'article-1', action: 'publish'})).rejects.toThrow(
    MutationGuardDeniedError,
  )
})

test('the translating hold covers publishing only', async () => {
  const bench = newBench()
  const instanceId = await startRun(bench)
  await reportAnalysis(bench, instanceId, ['de-DE'])

  const updated = await bench.editDocument({
    documentId: 'article-1',
    patch: {set: {title: 'Retitled mid-translation'}},
  })
  expect(updated?.title).toBe('Retitled mid-translation')
})

test('a field-tier subject is held while its locales are written into it', async () => {
  const bench = createBench({
    now: T0,
    documents: [
      {_id: 'person-1', _type: 'person', name: 'Ada'},
      {_id: 'drafts.person-1', _type: 'person', name: 'Ada'},
    ],
  })
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('person-1', {type: 'person'})],
    perspective: startPerspectiveFor('person'),
  })

  await reportAnalysis(bench, instance._id, ['de-DE'])

  expect(await guardNames(bench, instance._id)).toEqual(['hold-source-publish-during-translation'])
  await expect(bench.editDocument({documentId: 'person-1', action: 'publish'})).rejects.toThrow(
    MutationGuardDeniedError,
  )

  await settleChildren(bench, instance._id)
  expect(await guardNames(bench, instance._id)).toEqual(['hold-source-publish-during-review'])
})

test('a document that needed no work never holds anything', async () => {
  const bench = newBench()
  const instanceId = await startRun(bench)

  await reportAnalysis(bench, instanceId, [])

  // The autonomous path skips review entirely, so it must not leave a hold behind.
  expect(await bench.currentStage(instanceId)).toBe('done')
  expect(await guardNames(bench, instanceId)).toEqual([])
  await bench.editDocument({documentId: 'article-1', action: 'publish'})
})

test('an aborted run releases its hold', async () => {
  const {bench, instanceId} = await runInReview()
  expect(await guardNames(bench, instanceId)).toEqual(['hold-source-publish-during-review'])

  await bench.abortInstance({instanceId, reason: 'superseded'})

  // Abandoning a run must not leave the source permanently unpublishable.
  expect(await guardNames(bench, instanceId)).toEqual([])
  await bench.editDocument({documentId: 'article-1', action: 'publish'})
})
