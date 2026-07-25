import type {WorkflowInstance} from '@sanity/workflow-engine'
import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {ANALYZE_SOURCE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

const SOURCE = {
  _id: 'article-1',
  _type: 'article',
  title: 'Bench-tested localization',
  language: 'en-US',
}

/** Reads a resolved workflow-scope field off an instance document. */
function fieldValue(instance: WorkflowInstance, name: string): unknown {
  return instance.fields.find((entry) => entry.name === name)?.value
}

async function startRun() {
  const bench = createBench({now: T0, documents: [SOURCE, {...SOURCE, _id: 'article-2'}]})
  await bench.deployDefinitions({
    expectedMinReaderModel: 4,
    definitions: localizationWorkflows,
  })
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  return {bench, instanceId: instance._id, instance}
}

/** Plays the analysis handler, reporting which locales the edit actually affects. */
async function reportAnalysis(
  bench: Awaited<ReturnType<typeof startRun>>['bench'],
  instanceId: string,
  materiality: string,
  locales: string[],
  analyzedRev = 'rev-1',
) {
  return bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'materiality'},
        value: {type: 'literal', value: materiality},
      },
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
 * Settles every locale child still awaiting its translation.
 *
 * `children()` returns the children of every stage visit, not just the open one,
 * so a re-entered `translating` stage sees earlier settled children alongside
 * the fresh cohort — only the ones with the effect still pending are playable.
 */
async function settleChildren(
  bench: Awaited<ReturnType<typeof startRun>>['bench'],
  instanceId: string,
  status: 'done' | 'failed' = 'done',
) {
  const settled = []
  for (const child of await bench.children({instanceId})) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await bench.completePendingEffect({instanceId: child._id, effect: TRANSLATE_LOCALE, status})
    settled.push(child)
  }
  return settled
}

test('a new run parks in analyzing with the analysis queued', async () => {
  const {bench, instanceId, instance} = await startRun()

  expect(instance.currentStage).toBe('analyzing')
  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([ANALYZE_SOURCE])
})

test('a cosmetic edit completes without spawning or involving a person', async () => {
  const {bench, instanceId} = await startRun()

  await reportAnalysis(bench, instanceId, 'cosmetic', [])

  // The autonomy dial: no locales need work, so the run finishes on its own.
  expect(await bench.currentStage(instanceId)).toBe('done')
  expect(await bench.children({instanceId})).toHaveLength(0)
})

test('a material edit spawns one run per affected locale', async () => {
  const {bench, instanceId} = await startRun()

  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'])

  expect(await bench.currentStage(instanceId)).toBe('translating')
  const children = await bench.children({instanceId})
  expect(children.map((child) => fieldValue(child, 'locale'))).toEqual(['de-DE', 'fr-FR'])
})

test('the parent waits until every locale has settled', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'])

  const [first] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: first._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })

  // One locale done, one still running — the cohort gate must hold.
  expect(await bench.currentStage(instanceId)).toBe('translating')

  await settleChildren(bench, instanceId)
  expect(await bench.currentStage(instanceId)).toBe('review')
})

test('approving the review pass completes the run', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE'])
  await settleChildren(bench, instanceId)

  const {instance} = await bench.fireAction({instanceId, activity: 'review', action: 'approve'})

  expect(instance.currentStage).toBe('approved')
  expect(fieldValue(instance, 'approval')).toBeDefined()
})

test('requesting changes returns the run to translating and re-arms the review', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE'])
  await settleChildren(bench, instanceId)

  const {instance} = await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {
      note: 'Warmer tone, keep the product name verbatim',
      locales: [{locale: 'de-DE', reason: 'reviewer'}],
    },
  })

  expect(instance.currentStage).toBe('translating')
  expect(fieldValue(instance, 'changeNote')).toBe('Warmer tone, keep the product name verbatim')

  // A second cohort spawns for the new visit, and the stage-scoped decision has
  // reset — otherwise the stale 'request-changes' would immediately re-fire.
  await settleChildren(bench, instanceId)
  expect(await bench.currentStage(instanceId)).toBe('review')

  const {instance: approved} = await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'approve',
  })
  expect(approved.currentStage).toBe('approved')
})

test('the reviewer note reaches the locale run that re-translates', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE'])
  await settleChildren(bench, instanceId)
  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'Too formal', locales: [{locale: 'de-DE', reason: 'reviewer'}]},
  })

  const children = await bench.children({instanceId})
  const latest = children[children.length - 1]
  expect(fieldValue(latest, 'revisionNote')).toBe('Too formal')
})

test('a failed analysis parks the run instead of advancing it', async () => {
  const {bench, instanceId} = await startRun()

  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'failed',
  })

  expect(await bench.currentStage(instanceId)).toBe('failed')
  expect(await bench.children({instanceId})).toHaveLength(0)
})

test('a failed locale still settles the cohort so the parent can be reviewed', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'])

  const children = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: children[0]._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })
  await bench.completePendingEffect({
    instanceId: children[1]._id,
    effect: TRANSLATE_LOCALE,
    status: 'failed',
  })

  // Both children are settled — one translated, one failed — so the reviewer
  // sees the partial result rather than the parent hanging forever.
  expect(await bench.currentStage(children[1]._id)).toBe('failed')
  expect(await bench.currentStage(instanceId)).toBe('review')
})

test('requesting changes for one locale leaves the others alone', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR', 'ja-JP'])
  await settleChildren(bench, instanceId)

  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'Too literal', locales: [{locale: 'ja-JP', reason: 'reviewer'}]},
  })

  // Only the objected-to locale is redone; the two the reviewer accepted are not
  // retranslated and are not billed for again.
  const redone = await settleChildren(bench, instanceId)
  expect(redone.map((child) => fieldValue(child, 'locale'))).toEqual(['ja-JP'])
  expect(await bench.currentStage(instanceId)).toBe('review')
})

test('requesting changes for every locale redoes all of them', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'])
  await settleChildren(bench, instanceId)

  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {
      note: 'Start over',
      locales: [
        {locale: 'de-DE', reason: 'reviewer'},
        {locale: 'fr-FR', reason: 'reviewer'},
      ],
    },
  })

  const redone = await settleChildren(bench, instanceId)
  expect(redone.map((child) => fieldValue(child, 'locale'))).toEqual(['de-DE', 'fr-FR'])
})

test('a source edit during review is surfaced, not acted on', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE'], 'rev-1')
  await settleChildren(bench, instanceId)
  expect(await bench.currentStage(instanceId)).toBe('review')

  // The source is republished while the reviewer has the run open.
  await bench.editDocument({documentId: 'article-1', patch: {set: {title: 'Retitled'}}})
  const {instance} = await bench.tick({instanceId})

  // Flagged for the reviewer — and still in review. Nothing was discarded and no
  // translation was silently redone.
  expect(fieldValue(instance, 'sourceChanged')).toBe(true)
  expect(instance.currentStage).toBe('review')
})

test('re-analyzing from source clears the warning and re-derives the locales', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE'], 'rev-1')
  await settleChildren(bench, instanceId)
  await bench.editDocument({documentId: 'article-1', patch: {set: {title: 'Retitled'}}})
  await bench.tick({instanceId})

  const {instance: refreshing} = await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'refresh-from-source',
  })
  expect(refreshing.currentStage).toBe('analyzing')

  // Re-entry is a clean slate: the stale warning is gone and a fresh analysis is
  // queued rather than reusing the previous verdict.
  expect(fieldValue(refreshing, 'sourceChanged')).toBeFalsy()
  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([ANALYZE_SOURCE])

  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'], 'rev-2')
  expect(await bench.currentStage(instanceId)).toBe('translating')
})

test('a narrowed re-run does not narrow the next pass', async () => {
  const {bench, instanceId} = await startRun()
  await reportAnalysis(bench, instanceId, 'material', ['de-DE', 'fr-FR'])
  await settleChildren(bench, instanceId)
  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'Only German', locales: [{locale: 'de-DE', reason: 'reviewer'}]},
  })
  await settleChildren(bench, instanceId)

  // Second review round, this time asking for everything: the earlier narrowing
  // must not have permanently dropped fr-FR from the run.
  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {
      note: 'Both now',
      locales: [
        {locale: 'de-DE', reason: 'reviewer'},
        {locale: 'fr-FR', reason: 'reviewer'},
      ],
    },
  })
  const redone = await settleChildren(bench, instanceId)
  expect(redone.map((child) => fieldValue(child, 'locale'))).toEqual(['de-DE', 'fr-FR'])
})

test('a second run for the same document is refused', async () => {
  const {bench} = await startRun()

  const preflight = await bench.evaluateStart({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  expect(preflight).toMatchObject({allowed: false})

  // A different document is unaffected.
  const other = await bench.evaluateStart({
    definition: 'localize-document',
    initialFields: [subjectField('article-2', {type: 'article'})],
  })
  expect(other).toMatchObject({allowed: true})
})

test('the locale child cannot be started on its own', async () => {
  const {bench} = await startRun()

  const startable = await bench.definitionsForDocument({
    document: {_id: 'article-2', _type: 'article'},
  })

  expect(startable.map((definition) => definition.name)).toContain('localize-document')
  expect(startable.map((definition) => definition.name)).not.toContain('localize-locale')
})
