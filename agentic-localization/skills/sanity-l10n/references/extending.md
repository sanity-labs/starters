# Extending the pattern

`@starter/l10n/workflows` and `@starter/l10n/effects` are an extension surface,
not just this starter's internals. The shipped definitions cover three shapes: a
document across its locales, one locale of one document, and a batch shipped as a
Content Release. Anything else — a legal review gate before publish, a
human-translator handoff for one market, a per-market approval chain, a
back-translation QA pass — is a new definition on the same layers.

The journey has four steps and one rule: **the bench comes before the deploy.**

## 1. Write the definition

`@sanity/workflow-engine/define` gives you `defineWorkflow`, `defineStage`,
`defineActivity`, `defineAction`, `defineTransition`, `defineField`.
`packages/l10n/src/workflows/localizeLocale.ts` is the smallest complete example
— read it first; it is one stage, one activity, three actions, two transitions,
and every non-obvious line is commented.

The shape decisions that matter:

- **Lifecycle.** `lifecycle: 'child'` makes a definition spawn-only: it cannot be
  started from a Studio picker or a Function, only by a parent's `spawn`. Use it
  for anything that has no meaning on its own.
- **Fields are the instance's state.** `initialValue: {type: 'input'}` marks a
  field the spawner or starter supplies. Everything else is written by effects or
  by a person through an action. Nothing about a run belongs on the content
  document.
- **Actions are guarded, not sequenced.** An action's `when` is a predicate over
  `$fields`, `$effectStatus`, cohort state. The engine decides when it can fire.
  Writing an ordered list of steps means fighting it.
- **Failure must reach a terminal stage.** An in-flight child still counts as
  active in its parent's cohort, so parking on failure hangs the parent. Every
  definition here declares the failure edge first and explicitly.
- **Effect names are registry keys.** Declare them as constants in one module the
  definition and the handler both import — `packages/l10n/src/workflows/effects.ts`
  is that module here. The engine matches by name alone, so a typo surfaces only
  at drain time.
- **Guards, not UI.** Holding `publish` on a subject while a run is open is a
  guard on the stage, not a disabled button. See the `hold-source-publish-*`
  guards in `packages/l10n/src/workflows/localizeDocument.ts`.

Before writing anything non-trivial, read
[`docs/WORKFLOW_ENGINE_MIGRATION.md`](../../../docs/WORKFLOW_ENGINE_MIGRATION.md)
§3. It records engine behaviour the official docs do not cover — cohort `status`
meaning _settled_ rather than _succeeded_, `current` going false once a spawning
stage is exited, triggers firing at most once per stage visit. Every item there
cost real debugging time.

## 2. Prove it on the bench

`createBench` from `@sanity/workflow-engine-test` runs the **real** engine in
memory: deterministic clock, no project, no network, no AI spend. This is the
only place a definition's behaviour is cheap to interrogate.

```ts
const bench = createBench({
  now: T0,
  documents: [
    /* seed content */
  ],
})
await bench.deployDefinitions({expectedMinReaderModel: 4, definitions: [myWorkflow]})
const {instance} = await bench.startInstance({
  definition: 'my-workflow',
  initialFields: [subjectField('article-1', {type: 'article'})],
})
```

From there: `bench.listPendingEffects`, `bench.children`, `bench.fireAction`,
`bench.completeEffect`, `bench.tick`. Every definition in this repo has a sibling
`*.test.ts`; the ones worth reading as models:

| Spec                                                          | Proves                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/l10n/src/workflows/pendingEffects.test.ts`          | At most one pending effect per instance, ever — the invariant the whole runtime rests on |
| `packages/l10n/src/workflows/localizeDocument.test.ts`        | The happy path start-to-approved, including fan-out and cohort settling                  |
| `packages/l10n/src/workflows/localizeDocument.guards.test.ts` | Guards actually hold the actions they claim to                                           |
| `packages/l10n/src/workflows/effectDispatch.test.ts`          | Only a drain reaches a handler; `tick` and `abort` never do                              |

Assert on invariants, not on transcripts. "No instance ever holds two pending
effects" survives a refactor; "stage 3 fires action 4" does not.

Run with `pnpm --filter @starter/l10n test`.

## 3. Satisfy the effects

Three options, in order of preference: reuse a shipped handler, wrap one, or
write your own.

A handler is `EffectHandler` — `(params, ctx) => Promise<void>` — and the
plumbing that is tedious to get right is exported from
`@starter/l10n/effects` (see `packages/l10n/src/effects/effectRuntime.ts`):

- `effectAlreadyDone(ctx)` — the at-least-once idempotency read. **Call it first,
  before spending anything.** Effects are redelivered; without this, redelivery
  costs a second AI call.
- `contentClientFor` / `agentClient` / `readSubjectDocument` — `ctx.client`
  addresses the workflows dataset only. All content traffic routes through these.
- `instancePerspective` — whether this run writes drafts or a release version.
- `requireGdr`, `requireString`, `optionalString`, `optionalRelease` — params
  arrive untyped; narrow them rather than casting.
- `siblingGdr`, `datasetOf` — GDR arithmetic.

`packages/l10n/src/effects/analyzeSource.ts` is the reference for an AI-calling
handler: idempotency read first, content read through the routed client, the
model's judgement narrowed to a closed vocabulary, and the locale list computed
in code so a hallucinated language tag can never start a run. That division —
**the model judges, the code decides** — is the pattern, not an implementation
detail.

Handlers get unit specs too, with a stubbed client:
`packages/l10n/src/effects/analyzeSource.test.ts`.

## 4. Register and deploy

Three registrations, all of which must agree:

1. **The deploy set** — add the definition to `sanity.workflow.ts`. It deploys as
   one set because a parent cannot spawn a child that is not deployed.
2. **The handler map** — add your handler to the map `functions/drain-effects`
   passes to `createEngine`. `functions/engine.ts` is the shared construction;
   note that `effectHandlers` is a parameter, so Functions that only `tick` keep
   the whole Agent Actions graph out of their bundle.
3. **The trigger** — if the run starts from a content event, add a
   `defineDocumentFunction` resource (or widen an existing filter) in
   `sanity.blueprint.ts`. If it starts from the Studio, add a `mappings` entry to
   `workflowStudioPlugin()`.

Then: `pnpm --filter @starter/functions build`, `pnpm exec sanity blueprints
deploy`, `pnpm workflows:deploy`.

## Keeping the extension composable

- **Stay on the node floor.** A definition or handler that imports `react`,
  `sanity` or `@sanity/ui` cannot run in a Function. The eslint zone over
  `packages/l10n/src/**` and `packages/l10n/src/exports.test.ts` will tell you,
  but check before adding the import.
- **Reuse the prompt assembly.** If the extension translates, build its request
  with `buildTranslateParams` from `@starter/l10n/prompts`. A second assembly
  path means context drift and an unmeasurable prompt.
- **New context types get new schema, not new fields on the run.** Context is
  content; state is the instance. This holds for extensions too.
- **Add a Function only when a trigger demands it.** The five that exist are the
  engine's runtime, not one per feature. `docs/FUNCTIONS.md` documents the add
  path (three steps) and why the artifacts are pre-bundled.
