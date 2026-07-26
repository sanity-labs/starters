import {EffectOutputsInvalidError} from '@sanity/workflow-engine'
import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

import {ANALYZE_SOURCE, TRANSLATE_LOCALE} from './effects'
import {localizeDocument} from './localizeDocument'
import {IN_PROGRESS_STAGES, LOCALIZE_DOCUMENT_STAGES, SETTLED_STAGES} from './stages'
import {localizationWorkflows} from './index'

const T0 = '2026-07-24T09:00:00.000Z'

async function startRun() {
  const bench = createBench({
    now: T0,
    documents: [{_id: 'article-1', _type: 'article', title: 'Source', language: 'en-US'}],
  })
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})
  const {instance} = await bench.startInstance({
    definition: 'localize-document',
    initialFields: [subjectField('article-1', {type: 'article'})],
  })
  return {bench, instanceId: instance._id}
}

function localesOp(locales: string[]) {
  return {
    type: 'field.set' as const,
    target: {scope: 'workflow' as const, field: 'targetLocales'},
    value: {
      type: 'literal' as const,
      value: locales.map((locale) => ({locale, reason: 'body changed'})),
    },
  }
}

async function reachTranslating(locales = ['de-DE']) {
  const {bench, instanceId} = await startRun()
  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [localesOp(locales)],
  })
  return {bench, instanceId}
}

test('a handler cannot smuggle back an output the effect never declared', async () => {
  const {bench, instanceId} = await startRun()

  // Neither effect declares `outputs`, so the allowlist is empty and any
  // returned value is off-contract. This is what stops a handler quietly
  // becoming a second, undocumented source of workflow state.
  await expect(
    bench.completePendingEffect({
      instanceId,
      effect: ANALYZE_SOURCE,
      status: 'done',
      outputs: {materiality: 'material'},
    }),
  ).rejects.toThrow(EffectOutputsInvalidError)

  // Rejected completions commit nothing, so the effect is still claimable.
  const pending = await bench.listPendingEffects({instanceId})
  expect(pending.map((effect) => effect.name)).toEqual([ANALYZE_SOURCE])
})

// No test for "completion ops must name their scope": an effect completion has
// no authoring site to infer scope from, so the engine rejects an unscoped op
// with EffectOpsInvalidError at runtime — but `scope` is also required by the
// op type, so a TypeScript handler cannot express the invalid case without a
// cast. The compiler is the real enforcement here; the runtime check only backs
// up callers that are not type-checked.

test('an effect settles exactly once', async () => {
  const {bench, instanceId} = await startRun()

  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [localesOp([])],
  })
  expect(await bench.listPendingEffects({instanceId})).toEqual([])

  // Delivery is at-least-once, so a drainer may dispatch a handler twice. The
  // second report has nothing left to complete.
  await expect(
    bench.completePendingEffect({instanceId, effect: ANALYZE_SOURCE, status: 'done'}),
  ).rejects.toThrow()
})

test('a locale run can report progress while translating', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})

  await bench.completePendingEffect({
    instanceId: child._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'translationProgress'},
        value: {type: 'literal', value: 100},
      },
    ],
  })

  const settled = await bench.getInstance({instanceId: child._id})
  expect(settled.fields.find((entry) => entry.name === 'translationProgress')?.value).toBe(100)
})

test('a locale run records the revision its machine output was written at', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})

  await bench.completePendingEffect({
    instanceId: child._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'machineRev'},
        value: {type: 'literal', value: 'rev-machine-de'},
      },
    ],
  })

  // The learning loop diffs machine output against the text the reviewer
  // approved, so the revision has to outlive the effect on the child instance —
  // readable from the same scope the engine's conditions see.
  expect(await bench.queryInScope({instanceId: child._id, groq: '$fields.machineRev'})).toBe(
    'rev-machine-de',
  )
})

test('progress outside 0-100 is refused', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})

  await expect(
    bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'translationProgress'},
          value: {type: 'literal', value: 150},
        },
      ],
    }),
  ).rejects.toThrow()
})

test('materiality is a closed list', async () => {
  const {bench, instanceId} = await startRun()

  // The analysis prompt is free to hallucinate; the field declaration is what
  // stops an unrecognised verdict reaching workflow state.
  await expect(
    bench.completePendingEffect({
      instanceId,
      effect: ANALYZE_SOURCE,
      status: 'done',
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'materiality'},
          value: {type: 'literal', value: 'catastrophic'},
        },
      ],
    }),
  ).rejects.toThrow()
})

test('the analysis explains its verdict to the reviewer', async () => {
  const {bench, instanceId} = await startRun()
  const explanation =
    'The body was rewritten; de-DE is the only market whose translation predates it.'

  await bench.completePendingEffect({
    instanceId,
    effect: ANALYZE_SOURCE,
    status: 'done',
    ops: [
      localesOp(['de-DE']),
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'explanation'},
        value: {type: 'literal', value: explanation},
      },
    ],
  })

  // Prose, unlike the verdict beside it: no closed list to fall foul of, and the
  // review surface reads it from the same scope the engine's conditions see.
  expect(await bench.queryInScope({instanceId, groq: '$fields.explanation'})).toBe(explanation)
})

test('only source-language documents are offered a localization run', async () => {
  const bench = createBench({
    now: T0,
    documents: [
      {_id: 'article-1', _type: 'article', title: 'Source', language: 'en-US'},
      {_id: 'article-fr', _type: 'article', title: 'La source', language: 'fr-FR'},
      {_id: 'person-1', _type: 'person', name: 'Ada'},
    ],
  })
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})

  // The filter reads the candidate document, so discovery must be asked with the
  // loaded document rather than an {_id, _type} stub — a stub has no `language`
  // and would look like a source to any language-based filter.
  const offered = async (document: {_id: string; _type: string; [key: string]: unknown}) =>
    (await bench.definitionsForDocument({document})).map((definition) => definition.name)

  expect(
    await offered({_id: 'article-1', _type: 'article', title: 'Source', language: 'en-US'}),
  ).toContain('localize-document')
  // A translation is an output of a run, never the input to one.
  expect(
    await offered({_id: 'article-fr', _type: 'article', title: 'La source', language: 'fr-FR'}),
  ).not.toContain('localize-document')
  // Field-level types carry no language field, so they stay offerable.
  expect(await offered({_id: 'person-1', _type: 'person', name: 'Ada'})).toContain(
    'localize-document',
  )
})

test('a failed locale is flagged for the reviewer', async () => {
  const {bench, instanceId} = await reachTranslating(['de-DE', 'fr-FR'])
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

  // Cohort `status` means *settled*, not *succeeded* — a child that terminated
  // into its own `failed` stage still reports status 'done'. Success lives in
  // the row's `stage`.
  const rows = await bench.queryInScope<{stage: string; status: string}[]>({
    instanceId,
    groq: `$subworkflows[activity == 'translate']`,
  })
  expect(rows.map((row) => row.status)).toEqual(['done', 'done'])
  expect(rows.map((row) => row.stage)).toEqual(['translated', 'failed'])

  // Captured inside `translating` and carried into review, so the reviewer is
  // told that some markets did not translate.
  const inReview = await bench.getInstance({instanceId})
  expect(inReview.currentStage).toBe('review')
  expect(inReview.fields.find((entry) => entry.name === 'hasFailedLocales')?.value).toBe(true)

  // Advisory, not a hard gate: shipping seven of eight markets is a decision the
  // operator is entitled to make, the same way sourceChanged reports drift
  // without blocking approval.
  const {instance} = await bench.fireAction({instanceId, activity: 'review', action: 'approve'})
  expect(instance.currentStage).toBe('approved')
})

test('a successful retry clears the failure flag', async () => {
  const {bench, instanceId} = await reachTranslating(['de-DE'])
  const [first] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: first._id,
    effect: TRANSLATE_LOCALE,
    status: 'failed',
  })

  const failed = await bench.getInstance({instanceId})
  expect(failed.fields.find((entry) => entry.name === 'hasFailedLocales')?.value).toBe(true)

  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'request-changes',
    params: {note: 'retry', locales: [{locale: 'de-DE', reason: 'reviewer'}]},
  })
  for (const child of await bench.children({instanceId})) {
    const pending = await bench.listPendingEffects({instanceId: child._id})
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await bench.completePendingEffect({
      instanceId: child._id,
      effect: TRANSLATE_LOCALE,
      status: 'done',
    })
  }

  // The stale `failed` row from the first attempt is still in $subworkflows, so
  // reassessing per visit is what keeps the flag honest.
  const retried = await bench.getInstance({instanceId})
  expect(retried.currentStage).toBe('review')
  expect(retried.fields.find((entry) => entry.name === 'hasFailedLocales')?.value).toBeFalsy()
})

test('the run records who decided what, and which work was automated', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: child._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })
  await bench.fireAction({
    instanceId,
    activity: 'review',
    action: 'approve',
    actor: {kind: 'person', id: 'g-ada', roles: ['editor']},
  })

  const {history} = await bench.getInstance({instanceId})
  const fired = history.filter((entry) => entry._type === 'actionFired')

  // The human decision is attributed and distinguishable from the triggers the
  // engine fired on its own.
  const approve = fired.find((entry) => entry.action === 'approve')
  expect(approve?.actor?.id).toBe('g-ada')
  expect(approve?.triggered).toBeFalsy()
  expect(fired.some((entry) => entry.action === 'fan-out' && entry.triggered)).toBe(true)

  // Effects are ledgered separately from the action that queued them.
  expect(history.some((entry) => entry._type === 'effectQueued')).toBe(true)
  expect(history.some((entry) => entry._type === 'spawned')).toBe(true)
  expect(
    history.some((entry) => entry._type === 'stageEntered' && entry.stage === 'approved'),
  ).toBe(true)
})

test('automated stages offer a caller nothing to do', async () => {
  const {bench, instanceId} = await startRun()

  const evaluation = await bench.evaluate({instanceId})
  const actions = evaluation.currentStage.activities.flatMap((activity) => activity.actions)

  expect(evaluation.canInteract).toBe(false)
  // Every action in `analyzing` is a trigger, so a UI must narrate them rather
  // than draw buttons that would throw if pressed.
  expect(actions.every((action) => action.triggered === true)).toBe(true)
})

test('review offers exactly the three reviewer verbs', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: child._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })

  const evaluation = await bench.evaluate({instanceId})
  const actions = evaluation.currentStage.activities.flatMap((activity) => activity.actions)

  expect(evaluation.canInteract).toBe(true)
  const callable = actions
    .filter((action) => !action.triggered)
    .map((action) => action.action.name)
    .sort()
  expect(callable).toEqual(['approve', 'refresh-from-source', 'request-changes'])

  // The drift detector lives alongside them but is the engine's to fire.
  const drift = actions.find((action) => action.action.name === 'source-changed')
  expect(drift?.triggered).toBe(true)
})

test('the engine reports where a run stops being autonomous', async () => {
  const {bench, instanceId} = await startRun()

  const {autonomy} = await bench.evaluate({instanceId})

  // The whole "opt-in and automated" claim, as a fact the engine derives from
  // the definition rather than something the starter asserts about itself.
  expect(autonomy.completesWithoutCaller).toBe('no')

  // Machine work and human work, distinguished. Everything up to review runs
  // itself; the only things needing a person are the three review verbs.
  expect(autonomy.waitsOn).toContainEqual({kind: 'effect', effect: ANALYZE_SOURCE})
  expect(autonomy.waitsOn).toContainEqual({
    kind: 'subworkflow',
    definition: 'localize-locale',
    resolved: false,
  })
  const humanGates = autonomy.waitsOn.filter((wait) => wait.kind === 'caller-action')
  expect(humanGates.map((wait) => wait.action).sort()).toEqual([
    'approve',
    'refresh-from-source',
    'request-changes',
  ])
  expect(humanGates.every((wait) => wait.stage === 'review')).toBe(true)
})

/**
 * `LocalizeDocumentStage` derives from `LOCALIZE_DOCUMENT_STAGES`, and the
 * definition declares its stages against that union — so the compiler already
 * rejects a stage the vocabulary does not name. This is the direction it cannot
 * see: a name in the vocabulary that no stage declares would widen the union
 * past anything a run can reach.
 */
test('the stage vocabulary is exactly the stages the definition declares', () => {
  expect([...LOCALIZE_DOCUMENT_STAGES].sort()).toEqual(
    localizeDocument.stages.map((stage) => stage.name).sort(),
  )
})

/**
 * The stage vocabulary the surfaces filter on, against the deployed definition.
 * `SubjectRun.stage` is an untyped string, so a renamed stage would silently
 * empty an inbox section or a dashboard column instead of failing to compile.
 */
test('every stage the surfaces filter on is a real stage of the definition', async () => {
  const bench = createBench({now: T0})
  await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: localizationWorkflows})

  const declared = new Map(localizeDocument.stages.map((stage) => [stage.name, stage]))

  // In progress means the run leaves under its own steam — nothing for a
  // surface to do but say so.
  for (const stage of IN_PROGRESS_STAGES) {
    expect(declared.has(stage)).toBe(true)
    expect(declared.get(stage)?.transitions ?? []).not.toEqual([])
  }

  // Settled means terminal: no transition can move the run back out.
  for (const stage of SETTLED_STAGES) {
    expect(declared.has(stage)).toBe(true)
    expect(declared.get(stage)?.transitions ?? []).toEqual([])
    expect(declared.get(stage)?.activities ?? []).toEqual([])
  }
})

test('approving is projected as the action that ends the stage', async () => {
  const {bench, instanceId} = await reachTranslating()
  const [child] = await bench.children({instanceId})
  await bench.completePendingEffect({
    instanceId: child._id,
    effect: TRANSLATE_LOCALE,
    status: 'done',
  })

  const evaluation = await bench.evaluate({instanceId})
  const approve = evaluation.currentStage.activities
    .flatMap((activity) => activity.actions)
    .find((action) => action.action.name === 'approve')

  expect(approve?.firing?.exitsStage).toBe(true)
  expect(approve?.firing?.transition).toBe('to-approved')
})
