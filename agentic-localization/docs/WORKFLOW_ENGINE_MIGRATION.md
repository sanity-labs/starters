# Handoff: migrating `agentic-localization` onto Sanity Editorial Workflows

Portable context for a clean-session agent. Everything below is either committed,
sitting in the working tree, or verified empirically against the engine — not
inferred from docs. Where the docs and reality disagree, this file records reality.

---

## 0. Where things stand

| PR                                    | State                     |
| ------------------------------------- | ------------------------- |
| **PR 1** — Studio v5 → v6             | **Committed** (`0d24679`) |
| **PR 2** — definitions + bench specs  | **Committed** (`b9f000b`) |
| **PR 3** — workflows dataset + deploy | **Committed** (`d3784c5`) |
| PR 4 — effect handlers + runtime      | Not started               |
| PR 5 — Studio and dashboard surfaces  | Not started               |
| PR 6 — field-level tier               | Not started               |

Branch: `feature/use-workflows-for-localization`. Baseline before this work was
169 tests; it is now **213** (`pnpm --filter @starter/l10n test`), with typecheck
clean across `packages/l10n`, `studio`, and `apps/translations-dashboard`, and
lint at 0 errors (6 pre-existing warnings in untouched files).

Also relevant: `/Users/noah/.claude/plans/familiarize-yourself-with-this-eager-dragonfly.md`
(the approved plan) and the project memories under
`~/.claude/projects/-Users-noah-Developer-starters/memory/`, notably
`project_workflow_engine_migration.md`.

---

## 1. What the starter is, and what must survive

Two load-bearing claims, per the landing page (`sanity.io/ai-translations`):

1. **Quality through context** — glossaries, style guides and do-not-translate
   rules as structured content, RAG-filtered against the source, with an eval
   framework proving the delta.
2. **Automation with human approval** — `glossaries + style guides → RAG filter →
promptAssembly → Agent API translate() → drafts → editor review → Content
Release → published`.

The migration replaces the orchestration under (2). It must not weaken (1).

**`buildTranslateParams()` (`packages/l10n/src/promptAssembly.ts:213`) is the seam
that matters.** `evals/translate.ts:32` already calls it. The `translate-locale`
effect handler **must call the same function**. If the handler assembles context
its own way, the eval suite keeps passing while proving nothing about production
and the headline quality claim silently decouples from the runtime. Treat a
diverging call path as a failed PR.

---

## 2. Locked decisions — do not re-litigate

Settled with the user through several rounds of grilling.

| Decision             | Choice                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Hierarchy            | 3 levels: `localize-campaign` → `localize-document` → `localize-locale`                     |
| Content Releases     | The batching mechanism; the campaign carries `release.ref`                                  |
| Review unit          | **One human pass over the whole document, all locales.** Locale children are machine-only   |
| Autonomy             | Owned by the definition (`when` trigger vs caller-fired). No config fields, no start inputs |
| Republish mid-flight | **Surface, never auto-act.** Flag it; the reviewer decides                                  |
| Partial failure      | **Surface, never block.** Flag it; the reviewer decides                                     |
| State split          | Instance owns workflow state; content documents own content state                           |
| Engine storage       | Dedicated `workflows` dataset                                                               |
| Field tier           | Same per-locale shape; only the handler's write target differs                              |

The governing principle the user gave, which resolves most new questions:
**the operator is the authority; automation is pure convenience.** Automation
notices things and does routine work. It never discards a person's work and never
decides where a person would expect to.

### The architectural end state

Stated by the user as the target for the starter overall, and the yardstick for
the remaining PRs:

> Spec-driven, unit- and e2e-tested code, in a modular monorepo of domain-specific
> packages with the smallest final bundle footprint, composed for the apps and
> anything deployed.

Three consequences worth acting on:

- **Deletion is the point.** ~4,600 lines of hand-rolled orchestration (§6) are
  being replaced by ~530 lines of declarative definitions plus ~490 lines of specs.
  A PR that adds the engine without removing the machinery it supersedes has done
  half the job.
- **`packages/l10n` should become several packages.** It is currently one package
  with fifteen sub-path exports — the sub-paths exist precisely to keep React out
  of serverless consumers, which is the problem a domain split solves properly.
  The organizing principle (user, 2026-07-24): **logical modules of core logic,
  behaviors, and components** — pure core logic (engine/stdlib only), behaviors
  (workflow definitions, prompt assembly, queries — React-free), components
  (Studio UI, the only layer allowed React/`@sanity/ui`), plus schemas. Do this
  _after_ the deletions in PR 5, so the split moves only code that survives.
- **e2e coverage does not exist yet.** Today there are unit tests and live-model
  evals. The bench suite proves the definitions but nothing exercises a deployed
  run end to end. Add once PR 4 makes a run actually executable. Strategy
  (user, 2026-07-24): **critical user journeys as Gherkin `.feature` files
  driven by racejar** (`racejar/playwright` for Studio/dashboard journeys,
  `racejar/vitest` for API-level); individual modules keep their own unit and
  integration tests. Prior art: `email-marketing/e2e` in this monorepo — copy
  its structure (fixtures/steps, sanity-client fixture, session-token
  storageState), but not its positional `Feature(featureText, defs)` call; the
  real signature is `Feature({featureText, stepDefinitions, parameterTypes?,
hooks?})`.

- **Skills teach the pattern, not this repo** (user, 2026-07-24). After the
  package split, refocus `skills/sanity-l10n` and `skills/add-l10n-frontend` on
  how the pattern works, its requirements, and how an agent adds its elements
  to a greenfield or brownfield project. Much of the current skill content
  documents machinery PRs 4–5 delete.
- **Distill comments, docs and the README** to just what a human or agent needs
  to operate and incorporate the pattern (user, 2026-07-24). A standing
  constraint on new writing from PR 4 onward, plus a final pass.

Bundle discipline already has a foothold worth preserving: `src/workflows/` imports
only `@sanity/workflow-engine/define`, and `src/core/` is React-free by design, so
both compose into Functions and the CLI at no UI cost. Verify with
`grep -rn "react\|@sanity/ui" <module>` before adding an import.

---

## 3. Engine facts learned the hard way

Every item here cost real time. None of it is obvious from the docs.

### Versions

- Editorial Workflows is at **0.23.0** and moves fast — seven releases in ten days
  around 2026-07-24. Breaking changes ship in **minors**.
- Every `@sanity/workflow-*` package is an **exact-version peer** of the others.
  Pinned exactly (no caret) in `pnpm-workspace.yaml`. Upgrade them as one set.
- `expectedMinReaderModel: 4`. 0.22 and 0.23 required no migration. Upgrade all
  readers (Studio, Functions, CLI, MCP, apps) _before_ deploying definitions.
- The Studio plugin needs **Sanity 6.3+**. There is no v5 path:
  `@sanity/workflow-studio` peers on `@sanity/sdk` and observes through the App
  SDK store.

### Spawning and cohorts

- **Spawn rows need a stable identity** or the engine refuses to fan out — it
  cannot tell "same row" from "new row" on stage re-entry. We project one:
  `forEach: '...[]{"_key": locale, locale, reason}'`.
- **Cohort `status` means _settled_, not _succeeded_.** A child that terminated
  into its own stage named `failed` still reports `status: 'done'`. Success lives
  in the row's **`stage`**.
- **`current` is false for every cohort row once the spawning stage is exited**,
  and rows **accumulate across visits** — after a successful retry you will see
  both `{de-DE, failed}` and `{de-DE, translated}`. Therefore: **read cohort
  outcomes inside the spawning stage**, where `current` is still valid, and
  snapshot them into a field. That is what `note-failed-locales` does.
- A child that parks in-flight counts as `active` in its parent's cohort forever.
  **Spawnable definitions must terminate on failure**; only the top-level campaign
  can afford to loop back.
- Spawned children **skip start requirements**, so `singleSubject` does not
  protect a campaign-spawned run. See §5, PR 5.
- Subworkflow depth cap is 6; we use 3.

### Actions, ops and effects

- **Effect names are a registry key, unique per definition.** You cannot declare
  the same effect twice, so a caller-fired "retry" twin of a triggered effect is
  impossible.
- **Triggers fire at most once per stage visit.** Consequently `resetActivity`
  re-arms an activity but leaves `pending: []`, and `setStage` back to the _same_
  stage is not a new visit. **A failed effect in a trigger-driven stage has no
  in-place recovery** — you need a loop-back edge to another stage. This is why
  `localize-campaign` returns to `ready` on publish failure.
- **Op `value` expressions cannot compute.** They are `literal | fieldRead | param
| actor | now | self | stage | object`. No GROQ. You cannot write a count into a
  field; you can only set a literal under a condition.
- **Action params have no defaults**, and writing an absent param into an `array`
  field throws `FieldValueShapeError`. Make such params `required`.
- **Effect `outputs` is a strict allowlist.** Undeclared values are rejected with
  `EffectOutputsInvalidError` and the completion commits nothing (the effect stays
  claimable). Our effects declare no outputs and write via completion `ops`.
- **Completion ops must name `target.scope`** explicitly — and the op type
  requires it, so TypeScript catches it before runtime does.
- Field `options.list` and numeric validation are enforced on every write path,
  including effect completions. This is what stops a hallucinated `materiality`
  reaching workflow state.

### Identity, guards, discovery

- **Actor ids must be account-global `sanityUserId`** (0.21+). A bare `'ada'` is
  rejected; the bench's own user is `g-bench-user`.
- **A guard's `idRefs` resolves to exactly one document.** An array idRef deploys
  no guard at all. This is why the parent cannot hold its `doc.refs` of documents.
- **Guards are advisory in the prerelease.** The Content Lake does not enforce them
  against raw clients. Dataset access control is the only hard boundary today.
- **`start.filter` reads the loaded candidate document.** Passing an `{_id, _type}`
  stub to `definitionsForDocument` silently defeats any field-based filter.

### CLI and deploy (learned in PR 3, against the real project)

- The CLI bin is `sanity-workflows`; `deploy` is an alias of
  `editorial-workflows deploy`. `--check` and `--dry-run` are mutually
  exclusive flags on the same command.
- The CLI discovers `sanity.workflow.{ts,js,mjs}` in **cwd** and loads it with
  **jiti** — so like `sanity.blueprint.ts`, the config cannot use
  `process.loadEnvFile` and parses `.env` manually.
- Auth is `SANITY_AUTH_TOKEN` or the `sanity login` session token (via
  `@sanity/cli-core` `getCliToken()`); no token plumbing needed when the CLI
  is already logged in.
- **Definition sharing is ON by default** — deploys upload definition versions
  to Sanity "to improve Editorial Workflows". Opt out per-deploy with
  `--no-share-defs`. A starter template should leave the default visible
  rather than silently opting users in or out.
- `sanity-workflows list` lists **instances**, not definitions. To confirm
  what is deployed, use `deploy --dry-run` (per-definition
  `unchanged/created/updated` summary).
- Blueprint `defineDataset` **creates** a fresh dataset when `ownershipAction`
  is omitted; `{type: 'attach'}` is only for adopting a dataset that already
  exists outside the stack (the main dataset pre-exists from `sanity init`,
  which is why it attaches). The `workflows` dataset deployed cleanly with
  just `deletionPolicy: 'retain'`.
- A blueprint redeploy **destroys and recreates the stack's Functions**
  ("automatically migrating Functions") — fine for stateless handlers, but a
  deploy mid-run briefly leaves no live Function; relevant once PR 4's
  drainer/heartbeat carry the pipeline.

### Test bench

- `createBench({now, documents})`, deterministic clock, no network, no project.
- `bench.children()` returns children of **all** stage visits, not just the open
  one. Filter by pending effect before "settling" them.
- `activeGuardsForDocument` **probes with an update**, so a publish-only guard
  never appears there. Use `guardsForInstance` for existence and
  `editDocument({action: 'publish'})` for denial.
- `editDocument({action: 'publish'})` promotes an existing `drafts.<id>` — seed one.
- `setStage` takes `targetStage`, not `to`.
- `queryInScope({instanceId, groq})` evaluates GROQ against the same snapshot the
  engine's conditions see. This is the fastest way to answer "what does the engine
  actually see here?" — use it before theorising.

### Repo-specific

- Vite 8 (via Studio v6) transforms with **oxc, not esbuild**; an `esbuild` vitest
  option is silently ignored. The shared `packages/tsconfig/base.json` sets
  `jsx: "preserve"`, which Vite 8 honours — `packages/l10n/tsconfig.json` overrides
  it to `react-jsx` so its components can be transformed. Do not change the base;
  the Next.js frontend needs `preserve`.
- pnpm 10.30 reads `overrides` from **`pnpm-workspace.yaml`**, not `package.json` —
  and overrides do **not** reach auto-installed peers. Declare such peers
  explicitly instead (that is why `@sanity/language-filter` is a direct dep).
- The starter has **no committed lockfile** (`*/pnpm-lock.yaml` is gitignored), so
  CI resolves fresh from catalog ranges every run. Version drift will surface in CI
  spontaneously.
- Docs discoverability is broken for this product: `search_docs` returns one result
  for the whole section and `docs/llms/editorial-workflows.txt` claims 2 pages when
  there are 34. Navigate by following links from
  `/docs/editorial-workflows/concepts`.

---

## 4. What exists today (PR 2)

`packages/l10n/src/workflows/`, exported at `@starter/l10n/workflows`:

- `effects.ts` — `ANALYZE_SOURCE`, `TRANSLATE_LOCALE`, `PUBLISH_RELEASE`,
  `SOURCE_LANGUAGE`. Shared so definitions and handlers cannot drift on strings.
- `localizeLocale.ts` — `lifecycle: 'child'`, machine-only.
  `translating → translated | failed`.
- `localizeDocument.ts` — standalone **and** spawnable (deliberately not `child`).
  `analyzing → translating → review → approved`, with `done` (no work needed) and
  `failed` as side exits.
- `localizeCampaign.ts` — `assembly → ready → publishing → published`, with a
  `publishing → ready` loop-back on failure.
- Four spec files, 44 tests.

Behaviour worth knowing before changing anything:

- **Autonomy is the `analyzing → done` short-circuit.** A cosmetic edit yields no
  locales and the run completes with no human and no children. There is no
  autonomy config field anywhere, by decision.
- **`sourceChanged`** is set by a trigger in `review` when the live subject `_rev`
  differs from `analyzedRev`. It flags; it never re-routes. It needs a `tick` from
  a publish Function to be observed — that is PR 4's job and the reason the
  heartbeat exists.
- **`hasFailedLocales`** is set inside `translating` (where `current` is valid) and
  reset on each visit, so a successful retry clears it.
- **Two reviewer verbs:** `request-changes(note, locales)` redoes exactly the named
  locales — `locales` is required, see §3; and `refresh-from-source` returns to
  `analyzing` and is the only path that spends another analysis call.
- **One guard:** `hold-source-publish-during-review` denies `publish` on the
  subject during review. `publish` only — denying `update` would contradict
  `sourceChanged`.

---

## 5. Remaining PRs

### PR 3 — workflows dataset + definition deploy — DONE (as built)

- `sanity.workflow.ts` at the repo root: one deployment, `{name:
'localization', tag: 'production', expectedMinReaderModel: 4,
workflowResource: {type: 'dataset', id: `${projectId}.workflows`},
definitions: localizationWorkflows}`. Env parse mirrors the blueprint's
  (jiti, §3). No `resourceAliases` — confirmed unnecessary by `--check`; the
  definitions embed no content references.
- `@sanity/workflow-cli` joined the exact-pin catalog block at 0.23.0. Root
  `package.json` gained dev deps `@sanity/workflow-cli`,
  `@sanity/workflow-engine` (for the `/define` import) and `@starter/l10n`
  (so jiti resolves the definitions import), plus a `workflows:deploy`
  script.
- **Deviation from the original plan (user-approved):** the `workflows`
  dataset is declared in `sanity.blueprint.ts` as a second `defineDataset`
  (private, `deletionPolicy: 'retain'`, no `ownershipAction` — see §3) rather
  than created imperatively in bootstrap. Infra stays declared in one place
  and PR 4's Functions bind to the same resource.
- `studio/scripts/bootstrap.ts` gained step 4, "Deploy workflow definitions":
  `pnpm exec sanity-workflows deploy` from the repo root, right after the
  blueprint deploy that guarantees the dataset exists. Deploys are
  idempotent.
- A parent cannot spawn a child that is not deployed — all three deploy
  together via `localizationWorkflows`.

Verified against the real project: `deploy --check` (3 definitions pass),
blueprint deploy created `workflows`, definitions landed as
`production.localize-{locale,document,campaign}.v1`, and `deploy --dry-run`
reports a no-op.

### PR 4 — effect handlers + runtime Functions

Handlers for the three effect names. Register on `createEngine({effectHandlers})`.

- `analyze-source` — the body of today's `functions/analyze-stale-translations`.
  Must write, via completion ops at **workflow** scope: `analyzedRev`,
  `materiality` (one of the closed list), and `targetLocales` as
  `[{locale, reason}]`. Delete the old Function.
- `translate-locale` — **must call `buildTranslateParams()`** (§1). Branch on the
  `release` binding: absent → write a draft; present → write a version into that
  release. Report progress with `ctx.setProgress('translationProgress', n)`.
- `publish-release` — schedule when `publishAt` is bound, else publish now. Make it
  idempotent: check `releases.get()` state before acting.

Runtime Functions in the existing `sanity.blueprint.ts`:

- `drain-effects` — on create/update of `sanity.workflow.instance` in the workflows
  dataset: `drainEffects` then `tick`.
- `heartbeat` — scheduled `tick`; this is what makes `sourceChanged` observable.
- `start-localization` — replaces `mark-translations-stale`; on publish of a
  source document, `startInstance` (pass a caller-supplied `instanceId` as the
  idempotency key) or `tick` an existing run.
- `handle-deleted-subject` — on delete, `instancesForDocument` then `abortInstance`
  sequentially; do not swallow individual failures.

**Backpressure lives here** (user's decision): the drainer decides how many effects
to claim per invocation. The old semaphores (5/5/8/3) are deleted, and the engine
does not throttle spawn — a 50-document campaign × 8 locales queues 400 AI calls.

Handlers must be idempotent on `ctx.effectKey`; delivery is at-least-once and the
claim lease is 5 minutes (`effectLeaseMs`).

**Verify:** `pnpm --filter l10n eval` must still pass with `qualityDelta >= 0`
across all three eval cases. That is the gate that keeps the quality claim honest.

### PR 5 — Studio and dashboard surfaces

- Add `@sanity/workflow-studio-plugin` (+ the matching `@sanity/workflow-*` set, all
  0.23.0) for the strip, Workflows view and badges.
- Rebuild the custom inspector on `useWorkflowSession`, **keeping side-by-side
  compare and per-field editing** — that is named product copy, and evaluation
  insights explain conditions over workflow fields, not content diffs.
  `PortableTextDiff`, `InlineDiff`, `StaleDiffPopover` survive; only their state
  source changes.
- Surface `sourceChanged` and `hasFailedLocales` in the review UI, and list the
  per-locale child runs with their stages. This is where partial failure becomes
  visible.
- `request-changes` needs a locale picker; it sends `[{locale, reason}]` and the
  list is required. Default all boxes checked so "redo everything" stays one click.
- Dashboard moves to `useWorkflowInstances` / `useDocumentWorkflows`; adopt
  `WorkflowDiagram` from `@sanity/workflow-diagram` (key it by instance id).
- **Campaign duplicate-run pre-check** (user's decision): before starting a
  campaign, call `instancesForDocument` for each selected document and tell the
  operator "3 of these are already being localized", letting them skip or take
  over. Do not add an engine-level start requirement — it would fail the whole
  batch because one document is busy.
- Then delete: the six duplicated translate pipelines and their limiters,
  `useStaleAIAnalysis`, `core/staleAnalysisCache`, `inFlightReducer`,
  `cellReducer`, `useBatchProcessState`, `deriveFieldCellStates` +
  `useStaleSyncEffect`, and `workflowStates[]` / `staleAnalysis` from the two
  metadata schemas. `translation.metadata` itself stays — it is the i18n plugin's
  join document and genuine content state.

While in this code: `plugin.ts:89` identifies badges _by exclusion_
(`badge.name !== ''`) and `sanity.config.ts` matches
`action.displayName === 'SchedulePublishAction'`. Both still work in v6 (verified)
but both are guesses about internals with no type or test to catch a break. This is
the natural moment to replace them.

### PR 6 — field-level tier

Move `person.bio` (`internationalizedArrayText`) onto the same three definitions —
`localize-document` already accepts `person` as a subject type.

The one genuine divergence: for the field tier every locale lives in **one**
document, so N locale children would patch the same `internationalizedArray`
concurrently. Either serialise the writes in a single child or use carefully keyed
patches. The existing code has a related comment about `@sanity/client` `.append()`
chaining that is worth reading first.

---

## 5a. The deletion inventory

The point of the migration. Measured, not estimated — `wc -l` at the time of
writing. Nothing here is deleted yet; PR 4 removes the Functions, PR 5 the rest.

| File                                                              |        LOC | Superseded by                                  |
| ----------------------------------------------------------------- | ---------: | ---------------------------------------------- |
| `translations/useFieldTranslateActions.ts`                        |        806 | `localize-locale` + effect handler             |
| `translations/useTranslateActions.ts`                             |        651 | `localize-locale` + effect handler             |
| `functions/analyze-stale-translations/index.ts`                   |        508 | `analyze-source` handler                       |
| `translations/useStaleAIAnalysis.ts`                              |        339 | Instance state removes the race it existed for |
| `dashboard/hooks/useSelectiveTranslation.ts`                      |        319 | Start N runs                                   |
| `dashboard/hooks/useBatchTranslationsWithProgress.ts`             |        299 | `localize-campaign`                            |
| `dashboard/lib/processDocumentTranslations.ts`                    |        288 | `localize-document`                            |
| `dashboard/hooks/useCreateMissingTranslations.ts`                 |        256 | `localize-document`                            |
| `dashboard/lib/translationExecutor.ts`                            |        193 | `translate-locale` handler                     |
| `dashboard/hooks/useRetranslateStale.ts`                          |        178 | `analyze-source` routing                       |
| `functions/mark-translations-stale/index.ts`                      |        146 | `start-localization` Function                  |
| `schemas/metadataFields.ts` (`workflowStates[]`, `staleAnalysis`) |        137 | Instance fields                                |
| `translations/deriveFieldCellStates.ts`                           |        130 | Instance state                                 |
| `core/staleAnalysisCache.ts`                                      |        126 | `effectKey` idempotency ledger                 |
| `dashboard/hooks/useBatchProcessState.ts`                         |        109 | Stage machine                                  |
| `translations/useStaleSyncEffect.ts`                              |         81 | Instance state                                 |
| `schemas/fieldTranslationMetadata.ts` (workflow half)             |         64 | Instance fields                                |
| **Total**                                                         | **~4,630** | ~530 lines of definitions + ~490 of specs      |

Also going: `createSemaphore` and the four divergent concurrency limits (5 in the
Studio pane, 5 in the field pane, 8 in the dashboard, 3 in the Function), and the
four disjoint status vocabularies — one of which detected a state by matching
`message?.includes('locales have been set')`.

`translation.metadata` itself **stays**. It is the document-internationalization
plugin's join document and genuine content state; only the workflow fields bolted
onto it are removed.

## 6. Deliberately not done

- **Assignment family** — `assignee`/`assignees`, the `claim` pair, `todoList`,
  `notes`, action `roles`. Coherent and enterprise-appropriate (`todoList` maps
  neatly onto ticking off locales within the single review pass), but it needs a
  people model the starter lacks. Adding role gates without one breaks the demo:
  the bench's default actor holds `*`, which satisfies **no** role gate. Product
  decision, not an oversight.
- **Blocking on a failed locale.** Expressible now, but the decision is to surface
  rather than block — shipping seven of eight markets is the operator's call.
- **Holding the translated documents.** Wanted, but a guard's `idRefs` resolves to
  one document and the translations live in children that are terminal before
  review. Needs a different shape.
- **Anything time-based.** No review SLA, no stale-run detection. The heartbeat in
  PR 4 currently has only `sourceChanged` to drive.
- **`targetLocales` member validation.** `materiality` is a closed list;
  array members are not, so a handler emitting a locale absent from `l10n.locale`
  would spawn a run for it.
- **`groups`** (presentation, PR 5) and **`initialValue: {type: 'query'}`** (could
  seed locales from `l10n.locale` documents; the analysis effect owns that today).

---

## 7. Verification

```bash
pnpm --filter @starter/l10n test     # 213 tests; the bench suite is the design gate
pnpm --filter l10n eval              # quality gate — needs credentials (PR 4 onward)
pnpm -r typecheck                    # note: `pretypecheck` runs typegen
pnpm lint                            # 0 errors expected; 6 pre-existing warnings
npx oxfmt --check .
pnpm exec sanity-workflows deploy --check   # from PR 3; `--dry-run` diffs deployed state
```

`pnpm -r test` suppresses output on success — a silent pass is a pass. Confirm by
passing a bogus flag if you doubt it; it reaches vitest.
