/**
 * The field tier's one structural conflict with the shared definition.
 *
 * A field-tier run's locale children write their translations into the
 * subject's own draft. The engine hydrates drafts by default, so
 * `$fields.subject._rev` moves on the run's own output and the `source-changed`
 * trigger reports drift that never happened. Starting the run under a
 * `published` perspective isolates it from itself.
 *
 * These specs pin that behaviour on both sides: the false positive under the
 * default perspective, its absence under the field-tier one, and that a real
 * publish still surfaces.
 */

import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import type {WorkflowPerspective} from '@sanity/workflow-engine'

import {startPerspectiveFor} from '../core/fieldTier'
import {ANALYZE_SOURCE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

const PUBLISHED = {
  _id: 'person-1',
  _type: 'person',
  name: 'Ada Lovelace',
  bio: [{_key: 'bio-en', _type: 'internationalizedArrayTextValue', language: 'en-US', value: 'Hi'}],
}
const DRAFT = {...PUBLISHED, _id: 'drafts.person-1'}

/**
 * A run parked in `review`, analyzed against whatever revision the engine sees
 * under `perspective` — which is what the `analyze-source` handler records.
 */
async function runInReview(perspective: WorkflowPerspective | undefined) {
  const bench = createBench({now: T0, documents: [PUBLISHED, DRAFT]})
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('person-1', {type: 'person'})],
    perspective,
  })
  const instanceId = instance._id

  const analyzedRev = await bench.queryInScope<string>({instanceId, groq: '$fields.subject._rev'})
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
        value: {type: 'literal', value: [{locale: 'de-DE', reason: 'missing translation'}]},
      },
    ],
  })

  for (const child of await bench.children({instanceId})) {
    await bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
    })
  }

  expect(await bench.currentStage(instanceId)).toBe('review')
  return {analyzedRev, bench, instanceId}
}

/** What a locale child does to a field-tier subject: patch its draft. */
async function writeTranslationIntoDraft(bench: Awaited<ReturnType<typeof runInReview>>['bench']) {
  await bench.client
    .patch('drafts.person-1')
    .set({
      bio: [
        ...PUBLISHED.bio,
        {
          _key: 'bio-de',
          _type: 'internationalizedArrayTextValue',
          language: 'de-DE',
          value: 'Hallo',
        },
      ],
    })
    .commit()
}

async function sourceChanged(
  bench: Awaited<ReturnType<typeof runInReview>>['bench'],
  instanceId: string,
) {
  await bench.tick({instanceId})
  return bench.queryInScope<boolean | null>({instanceId, groq: '$fields.sourceChanged'})
}

test('the default perspective reports a run’s own draft writes as source drift', async () => {
  const {bench, instanceId} = await runInReview(undefined)

  await writeTranslationIntoDraft(bench)

  // The bug this tier has to avoid: nobody touched the English, but the draft
  // revision moved because the run wrote its own German into it.
  expect(await sourceChanged(bench, instanceId)).toBe(true)
})

test('a field-tier run does not see its own draft writes', async () => {
  const {bench, instanceId} = await runInReview(startPerspectiveFor('person'))

  await writeTranslationIntoDraft(bench)

  expect(await sourceChanged(bench, instanceId)).toBeFalsy()
})

test('a field-tier run still reports a real publish of the source', async () => {
  const {analyzedRev, bench, instanceId} = await runInReview(startPerspectiveFor('person'))

  // Written straight onto the published id rather than through `publish`:
  // review's hold denies that action, and guards are advisory anyway — the
  // point is that the published layer moving is what the trigger reacts to.
  await bench.client.patch('person-1').set({name: 'Augusta Ada King'}).commit()

  expect(await bench.queryInScope<string>({instanceId, groq: '$fields.subject._rev'})).not.toBe(
    analyzedRev,
  )
  expect(await sourceChanged(bench, instanceId)).toBe(true)
})

test('the field-tier perspective is chosen by document type, not by caller', () => {
  expect(startPerspectiveFor('person')).toBe('published')
  expect(startPerspectiveFor('article')).toBeUndefined()
})
