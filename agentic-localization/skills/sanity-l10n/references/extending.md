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

### What the engine does not document

Verified against the engine itself. Read this before writing anything
non-trivial; every item cost real debugging time.

- **Spawn rows need a stable identity.** Without one the engine cannot tell "same
  row" from "new row" on stage re-entry, and refuses to fan out. Project a key:
  `forEach: '...[]{"_key": locale, locale, reason}'`.
- **Cohort `status` means _settled_, not _succeeded_.** A child that terminated
  into its own `failed` stage still reports `status: 'done'`. Success lives in the
  row's `stage`.
- **Read cohort outcomes inside the spawning stage.** `current` is false for every
  row once that stage is exited, and rows accumulate across visits — after a
  successful retry you see both `{de-DE, failed}` and `{de-DE, translated}`.
  Snapshot what you need into a field while the stage is still open.
- **Spawned children skip start requirements**, so `singleSubject` does not
  protect a run a parent spawned. Subworkflow depth caps at 6.
- **Triggers fire at most once per stage visit.** `resetActivity` re-arms an
  activity but leaves `pending: []`, and `setStage` to the _same_ stage is not a
  new visit — so a failed effect in a trigger-driven stage has no in-place
  recovery. Give it a loop-back edge to another stage.
- **Op `value` expressions cannot compute.** They are `literal`, `fieldRead`,
  `param`, `actor`, `now`, `self`, `stage` or `object` — no GROQ. You cannot write
  a count into a field.
- **Action params have no defaults**, and writing an absent param into an `array`
  field throws `FieldValueShapeError`. Make such params `required`.
- **Effect `outputs` is a strict allowlist.** An undeclared value rejects the whole
  completion (`EffectOutputsInvalidError`) and leaves the effect claimable. The
  handlers here declare no outputs and write through completion `ops` instead.
- **Field `options.list` and numeric validation hold on every write path**, effect
  completions included. That is what stops a hallucinated `materiality` reaching
  workflow state.
- **Actor ids are account-global `sanityUserId`.** A bare `'ada'` is rejected; the
  bench's own user is `g-bench-user`.
- **A guard's `idRefs` resolves to exactly one document.** An array idRef deploys
  no guard at all, which is why a parent cannot hold the documents its children
  write. Two stages may each declare a guard if the names differ, and exiting a
  stage deletes its guard as the next stage's is created — a hold hands over with
  no gap.
- **Guards are advisory in the prerelease.** The Content Lake does not enforce them
  against a raw client; dataset access control is the only hard boundary today.
- **`start.filter` reads the loaded candidate document.** Passing an
  `{_id, _type}` stub to `definitionsForDocument` silently defeats it.
- **`resourceClients` IS the deployment's ref declaration.** The surface a
  runtime-supplied ref is checked against is `workflowResource` plus whatever
  that resolver serves — nothing else. `resourceAliases` on the deployment is a
  deploy-time alias expansion inside definitions and widens nothing at
  `startInstance`. A split-dataset host without the resolver cannot start a run:
  every subject, `doc.refs` row and `release.ref` is refused with
  `RefResourceUndeclaredError`. `@sanity/workflow-studio`'s `useWorkflowEngine`
  wires it by default; a hand-built engine does not.
- **A `release.ref` input takes no empty value.** `null` and `undefined` both
  fail `assertInputValueShape`, and `InitialFieldValue` types every value as
  `NonNullable`. "No release" is expressed by omitting the entry, never by
  seeding a blank one.
- **The Studio plugin's Start dialog gates on field _kind_, not `required`.**
  `@sanity/workflow-studio-plugin@0.23.0` renders every input-sourced entry the
  mapping does not cover and blocks Start until each is filled, exempting only
  `array`, `assignees` and `doc.refs`. An optional `release.ref` is therefore
  demanded — and only in the dialog: the same plugin's auto-start path reads the
  definition's `required` flag, and an omitted entry starts fine. See "Localize
  from the Studio picker asks for a release" in `operating.md`.

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

Three bench behaviours to know before fighting them:

- `bench.children()` returns children of **all** stage visits, not just the open
  one. Filter by pending effect before settling them.
- `activeGuardsForDocument` probes with an update, so a publish-only guard never
  appears there. Use `guardsForInstance` for existence and
  `editDocument({action: 'publish'})` for denial.
- `queryInScope({instanceId, groq})` evaluates GROQ against the same snapshot the
  engine's conditions see. Use it before theorising about what a condition reads.

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
- `instancePerspective` — whether this run writes drafts or a release version. A
  handler that records a revision the engine later compares must read under
  `instance.perspective ?? 'drafts'`; reading the other layer makes `analyzedRev`
  unmatchable and `sourceChanged` permanently true.
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
   Anything that builds an engine by hand must also declare its content
   resource. The engine gates every ref a caller supplies — `startInstance`
   initial fields, an action's param-sourced op values, an effect's completion ops
   — on the deployment's declared surface, and throws
   `RefResourceUndeclaredError` otherwise. With engine storage in its own dataset,
   every content ref is off-surface until a `resourceClients` resolver serves it;
   returning the client _is_ the declaration (`projectResourceClients`).
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
- **Add a Function only when a trigger demands it.** The four declared in the
  blueprint are the engine's runtime, not one per feature. `docs/FUNCTIONS.md`
  documents the add path (three steps) and why the artifacts are pre-bundled.
