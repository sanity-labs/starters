/**
 * What the learning loop's Function is allowed to assume.
 *
 * `distill-review` triggers on an instance document reaching `APPROVED_STAGE`
 * and then reads the run's shape back out of it. Neither half is checked by a
 * compiler: the trigger is a GROQ string in a jiti-loaded blueprint, and the
 * reads walk fields the engine writes at runtime. So both are pinned here,
 * against the real engine.
 */

import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {buildLocaleRuns, toChildRun} from '../core/localeRuns'
import {readLocaleRequests, readText} from '../core/instanceFields'
import {ANALYZE_SOURCE, APPROVED_STAGE, TRANSLATE_LOCALE} from './effects'
import {localizeDocument} from './localizeDocument'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

const SOURCE = {_id: 'article-1', _type: 'article', title: 'The dataset guide', language: 'en-US'}

/** A whole run: publish, analyze, translate two locales, approve. */
async function approvedRun(locales = ['de-DE', 'fr-FR']) {
  const bench = createBench({now: T0, documents: [SOURCE]})
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  const {instance} = await bench.startInstance({
    definition: localizeDocument.name,
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  const instanceId = instance._id

  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      set('analyzedRev', 'rev-analyzed'),
      set(
        'targetLocales',
        locales.map((locale) => ({locale, reason: 'body changed'})),
      ),
    ],
  })

  for (const child of await bench.children({instanceId})) {
    const locale = readText(child.fields, 'locale')
    await bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'target'},
          // A sibling of the subject, derived rather than spelled out: the engine
          // rejects any ref outside the deployment's declared resource surface,
          // and the bench declares only its own store.
          value: {
            type: 'literal',
            value: {id: sibling(child, `article-1-${locale}`), type: 'article'},
          },
        },
        set('machineRev', `rev-machine-${locale}`),
      ],
    })
  }

  await bench.fireAction({instanceId, activity: 'review', action: 'approve'})
  return {bench, instanceId}
}

/** Another document in the same resource as the child's `source`. */
function sibling(child: {fields: readonly {name: string; value?: unknown}[]}, id: string): string {
  const source = child.fields.find((field) => field.name === 'source')?.value
  const gdr =
    typeof source === 'object' && source !== null && 'id' in source ? String(source.id) : ''
  return gdr.replace(/[^:]+$/, id)
}

function set(field: string, value: unknown) {
  return {
    type: 'field.set' as const,
    target: {scope: 'workflow' as const, field},
    value: {type: 'literal' as const, value},
  }
}

test('the approved stage the trigger names is a real terminal stage', async () => {
  const {bench, instanceId} = await approvedRun()
  const approved = await bench.getInstance({instanceId})

  expect(approved.currentStage).toBe(APPROVED_STAGE)
  // the terminal marker is `completedAt`, not `terminatedAt`/`abortedAt`.
  expect(approved.completedAt).toBeDefined()
  expect(approved.abortedAt).toBeUndefined()

  // Terminal in the definition too, so the trigger fires once and the instance
  // never leaves the stage under its own steam.
  const declared = localizeDocument.stages.find((stage) => stage.name === APPROVED_STAGE)
  expect(declared).toBeDefined()
  expect(declared?.transitions ?? []).toEqual([])
  expect(declared?.activities ?? []).toEqual([])
})

test('an approved run has nothing left pending for a drainer to claim', async () => {
  const {bench, instanceId} = await approvedRun()

  expect(await bench.listPendingEffects({instanceId})).toEqual([])
  for (const child of await bench.children({instanceId})) {
    expect(await bench.listPendingEffects({instanceId: child._id})).toEqual([])
  }
})

test('the approved instance carries the fields the gatherer reads', async () => {
  const {bench, instanceId} = await approvedRun()
  const approved = await bench.getInstance({instanceId})

  expect(approved.definition).toBe(localizeDocument.name)
  expect(readText(approved, 'analyzedRev')).toBe('rev-analyzed')
  expect(readLocaleRequests(approved, 'targetLocales').map((row) => row.locale)).toEqual([
    'de-DE',
    'fr-FR',
  ])
})

test('every subworkflow row resolves with the stage the gatherer filters on', async () => {
  const {bench, instanceId} = await approvedRun()
  const {subworkflows = []} = await bench.getInstance({instanceId})

  expect(subworkflows).toHaveLength(2)
  for (const row of subworkflows) {
    expect(row.rowKey).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
    expect(row.spawnedAt).toEqual(expect.any(String))
    expect(row.ref.id).toEqual(expect.any(String))
    // Not `status`: cohort status means settled. The outcome is the stage.
    expect(row.resolved?.stage).toBe('translated')
  }
})

test('the locale rows the gatherer builds carry a machine revision and a target', async () => {
  const {bench, instanceId} = await approvedRun()
  const parent = await bench.getInstance({instanceId})
  const children = (await bench.children({instanceId})).map(toChildRun)

  const runs = buildLocaleRuns({
    targetLocales: readLocaleRequests(parent, 'targetLocales'),
    subworkflows: parent.subworkflows ?? [],
    children,
  })

  // The whole read path in one assertion: this is what `gatherRun` turns into a
  // History request per locale.
  expect(runs.map((run) => [run.locale, run.stage, run.machineRev, run.targetDocumentId])).toEqual([
    ['de-DE', 'translated', 'rev-machine-de-DE', 'article-1-de-DE'],
    ['fr-FR', 'translated', 'rev-machine-fr-FR', 'article-1-fr-FR'],
  ])
})

/**
 * The fallback when a child never recorded `machineRev` — a redelivered effect
 * that found the version it had already created writes no revision of its own.
 * `ranAt` is stamped at COMPLETION and `durationMs` is never written, so the only
 * usable form is `?time=<ranAt>`, never an interval.
 */
test('a settled translate effect leaves a completion timestamp and no duration', async () => {
  const {bench, instanceId} = await approvedRun(['de-DE'])
  const [child] = await bench.children({instanceId})
  const {effectHistory} = await bench.getInstance({instanceId: child._id})

  const translate = effectHistory.find((entry) => entry.name === TRANSLATE_LOCALE)
  expect(translate?.status).toBe('done')
  expect(translate?.ranAt).toEqual(expect.any(String))
  expect(translate?.durationMs).toBeUndefined()
})
