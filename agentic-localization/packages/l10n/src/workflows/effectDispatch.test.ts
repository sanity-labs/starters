/**
 * Which engine verbs dispatch effects.
 *
 * `functions/engine.ts` hands the same construction to four Functions, but only
 * `drain-effects` calls `drainEffects`. The other three call `tick` and
 * `abortInstance`, which advance an instance without ever invoking a handler —
 * so they can be built with an empty handler map and keep the AI-calling code
 * (and everything it imports) out of their bundles.
 *
 * That is an engine property, not a definitions property, and the runtime is
 * configured with `missingHandler: 'skip'`, which would swallow the evidence if
 * it ever stopped holding. So this bench asserts it directly: handlers that
 * record every call, `missingHandler: 'fail'` so an unmatched dispatch throws
 * rather than passing silently, and an instance parked on a pending effect for
 * each verb under test.
 */

import type {EffectHandler} from '@sanity/workflow-engine'

import {createBench, createBenchEngine, subjectField} from '@sanity/workflow-engine-test'
import {beforeEach, expect, test} from 'vitest'

import {ANALYZE_SOURCE, EFFECT_NAMES, PUBLISH_RELEASE, TRANSLATE_LOCALE} from './effects'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

let dispatched: string[] = []

beforeEach(() => {
  dispatched = []
})

/** Records the dispatch, then completes so a drain still makes progress. */
function recordingHandler(name: string): EffectHandler {
  return async () => {
    dispatched.push(name)
  }
}

const recordingHandlers: Record<string, EffectHandler> = Object.fromEntries(
  EFFECT_NAMES.map((name) => [name, recordingHandler(name)]),
)

/**
 * A document run parked on its first pending effect, plus two engines over the
 * same store: one registered the way `drain-effects` is, one the way the other
 * three Functions would be.
 */
async function parkedRun() {
  const bench = createBench({
    now: T0,
    documents: [{_id: 'article-1', _type: 'article', title: 'One', language: 'en-US'}],
  })
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})

  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  const instanceId = instance._id

  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([ANALYZE_SOURCE])

  return {
    bench,
    instanceId,
    /** How `drain-effects` is built. */
    draining: createBenchEngine(bench, {
      effectHandlers: recordingHandlers,
      missingHandler: 'fail',
    }),
    /** How `start-localization` and `handle-deleted-subject` are built. */
    nonDraining: createBenchEngine(bench, {effectHandlers: {}, missingHandler: 'fail'}),
  }
}

test('tick does not dispatch effects, with or without a handler map', async () => {
  const {draining, instanceId, nonDraining} = await parkedRun()

  await draining.tick({instanceId})
  expect(dispatched).toEqual([])

  // `missingHandler: 'fail'` means an empty map cannot hide a dispatch: a tick
  // that tried to run `analyze-source` would throw here instead of no-opping.
  await nonDraining.tick({instanceId})
  expect(dispatched).toEqual([])
})

test('abortInstance does not dispatch effects, with or without a handler map', async () => {
  const {instanceId, nonDraining} = await parkedRun()

  await nonDraining.abortInstance({
    instanceId,
    reason: 'Subject deleted',
    idempotencyKey: 'delete:article-1',
  })
  expect(dispatched).toEqual([])
})

test('drainEffects is the only verb that reaches a handler', async () => {
  const {draining, instanceId} = await parkedRun()

  const {drained, failed, skipped} = await draining.drainEffects({instanceId})

  expect(dispatched).toEqual([ANALYZE_SOURCE])
  expect(drained).toHaveLength(1)
  expect(failed).toEqual([])
  expect(skipped).toEqual([])
})

test('the recorded map covers every effect the definitions declare', () => {
  expect(Object.keys(recordingHandlers).sort()).toEqual(
    [ANALYZE_SOURCE, PUBLISH_RELEASE, TRANSLATE_LOCALE].sort(),
  )
})
