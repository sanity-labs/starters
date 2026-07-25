import {gdrRef, type WorkflowInstance} from '@sanity/workflow-engine'
import {createBench, DEFAULT_WORKFLOW_RESOURCE, releaseField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {ANALYZE_SOURCE, PUBLISH_RELEASE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'
const DOCUMENT_IDS = ['article-1', 'article-2']

function fieldValue(instance: WorkflowInstance, name: string): unknown {
  return instance.fields.find((entry) => entry.name === name)?.value
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
  const bench = createBench({
    now: T0,
    documents: DOCUMENT_IDS.map((_id) => ({
      _id,
      _type: 'article',
      title: _id,
      language: 'en-US',
    })),
  })
  await bench.deployDefinitions({
    expectedMinReaderModel: 4,
    definitions: localizationWorkflows,
  })
  const {instance} = await bench.startInstance({
    definition: 'localize-campaign',
    initialFields: [releaseField('spring-launch'), documentsField(DOCUMENT_IDS)],
  })
  return {bench, instanceId: instance._id, instance}
}

/** Drives one spawned document run all the way to `approved`. */
async function approveDocumentRun(
  bench: Awaited<ReturnType<typeof startCampaign>>['bench'],
  documentInstanceId: string,
  locales: string[],
) {
  await bench.completePendingEffect({
    instanceId: documentInstanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'materiality'},
        value: {type: 'literal', value: 'material'},
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

  for (const child of await bench.children({instanceId: documentInstanceId})) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
    })
  }

  await bench.fireAction({instanceId: documentInstanceId, activity: 'review', action: 'approve'})
}

test('a campaign spawns one document run per document', async () => {
  const {bench, instanceId, instance} = await startCampaign()

  expect(instance.currentStage).toBe('assembly')
  const children = await bench.children({instanceId})
  expect(children).toHaveLength(2)
  expect(children.every((child) => child.definition === 'localize-document')).toBe(true)
})

test('the release reaches every locale run three levels down', async () => {
  const {bench, instanceId} = await startCampaign()

  const [firstDocument] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: firstDocument._id,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'targetLocales'},
        value: {type: 'literal', value: [{locale: 'de-DE', reason: 'body changed'}]},
      },
    ],
  })

  const [localeRun] = await bench.children({instanceId: firstDocument._id})
  expect(fieldValue(localeRun, 'locale')).toBe('de-DE')
  // Campaign -> document -> locale: the release is what makes the batch ship
  // together, so it has to survive both spawn hops.
  expect(fieldValue(localeRun, 'release')).toMatchObject({releaseName: 'spring-launch'})
})

test('the campaign holds until every document is approved', async () => {
  const {bench, instanceId} = await startCampaign()
  const [first, second] = await bench.children({instanceId})

  await approveDocumentRun(bench, first._id, ['de-DE'])
  expect(await bench.currentStage(instanceId)).toBe('assembly')

  await approveDocumentRun(bench, second._id, ['fr-FR', 'ja-JP'])
  expect(await bench.currentStage(instanceId)).toBe('ready')
})

test('a document needing no work still settles its slot in the campaign', async () => {
  const {bench, instanceId} = await startCampaign()
  const [first, second] = await bench.children({instanceId})

  // Cosmetic: completes autonomously without review, and the campaign counts it.
  await bench.completePendingEffect({
    instanceId: first._id,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'targetLocales'},
        value: {type: 'literal', value: []},
      },
    ],
  })
  expect(await bench.currentStage(first._id)).toBe('done')

  await approveDocumentRun(bench, second._id, ['de-DE'])
  expect(await bench.currentStage(instanceId)).toBe('ready')
})

test('publishing now ships the release and completes the campaign', async () => {
  const {bench, instanceId} = await startCampaign()
  for (const child of await bench.children({instanceId})) {
    await approveDocumentRun(bench, child._id, ['de-DE'])
  }

  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})
  expect(await bench.currentStage(instanceId)).toBe('publishing')

  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([PUBLISH_RELEASE])

  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'done'})
  expect(await bench.currentStage(instanceId)).toBe('published')
})

test('scheduling records the go-live time before publishing', async () => {
  const {bench, instanceId} = await startCampaign()
  for (const child of await bench.children({instanceId})) {
    await approveDocumentRun(bench, child._id, ['de-DE'])
  }

  const publishAt = '2026-08-01T09:00:00.000Z'
  const {instance} = await bench.fireAction({
    instanceId,
    activity: 'go-live',
    action: 'schedule',
    params: {publishAt},
  })

  expect(fieldValue(instance, 'publishAt')).toBe(publishAt)
  expect(instance.currentStage).toBe('publishing')
})

test('a failed release publish never reports success', async () => {
  const {bench, instanceId} = await startCampaign()
  for (const child of await bench.children({instanceId})) {
    await approveDocumentRun(bench, child._id, ['de-DE'])
  }
  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})

  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'failed'})

  expect(await bench.currentStage(instanceId)).not.toBe('published')
  expect(await bench.currentStage(instanceId)).toBe('ready')
})

test('an operator can retry a failed publish and finish the campaign', async () => {
  const {bench, instanceId} = await startCampaign()
  for (const child of await bench.children({instanceId})) {
    await approveDocumentRun(bench, child._id, ['de-DE'])
  }
  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})
  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'failed'})

  // Back at the go-live decision: firing it again is a fresh `publishing` visit,
  // which re-arms the trigger and re-queues the effect.
  await bench.fireAction({instanceId, activity: 'go-live', action: 'publish-now'})
  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([PUBLISH_RELEASE])

  await bench.completePendingEffect({instanceId, effect: PUBLISH_RELEASE, status: 'done'})
  expect(await bench.currentStage(instanceId)).toBe('published')
})
