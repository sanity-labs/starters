# Handoff: migrating `agentic-localization` onto Sanity Editorial Workflows

Portable context for a clean-session agent. Everything below is either committed,
sitting in the working tree, or verified empirically against the engine — not
inferred from docs. Where the docs and reality disagree, this file records reality.

---

## 0. Where things stand

| PR                                       | State                               |
| ---------------------------------------- | ----------------------------------- |
| **PR 1** — Studio v5 → v6                | **Committed** (`0d24679`)           |
| **PR 2** — definitions + bench specs     | **Committed** (`b9f000b`)           |
| **PR 3** — workflows dataset + deploy    | **Committed** (`d3784c5`)           |
| **PR 4** — effect handlers + runtime     | **Committed** (`c6f3713`)           |
| **PR 5** — Studio and dashboard surfaces | **Committed** (`250bf89`…`fe55583`) |
| **PR 6a** — field tier, engine + runtime | **Committed** (`11f5716`)           |
| **PR 6b** — field tier, Studio surfaces  | **Committed** (`125da0d`)           |
| **machineRev** — loop capture (ADR-002)  | **Committed** (`7b26a7f`)           |
| **Package split** (ADR-001)              | **Committed** (this commit)         |

Branch: `feature/use-workflows-for-localization`. Baseline before this work was
169 tests; it is now **312** (`pnpm --filter @starter/l10n test`) — 6a's 322 less
the specs for the machinery 6b deleted, plus 6b's own — with typecheck clean
across `packages/l10n`, `studio`, and `apps/translations-dashboard`, and lint at
**0 errors, 0 warnings** (all six pre-existing warnings lived in files 6b removed).

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
- **The package shape is DECIDED and BUILT** — see
  `docs/decisions/adr-001-package-shape.md`. Two packages on the React line
  (`@starter/l10n` node floor with layer entries `.`/`./prompts`/`./workflows`/
  `./effects`; `@starter/l10n-studio` for everything React/Studio), settled by
  an adversarial debate, a verifying judge, and two owner rulings. The starter
  is a **reference**: each entry is an extension surface for building custom
  translation workflows on the layers.
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
  documents machinery PRs 4–5 delete. The reworked skills ship **with skill
  evals** (trigger, routing, guidance) living alongside them in the repo.
- **Distill comments, docs and the README** to just what a human or agent needs
  to operate and incorporate the pattern (user, 2026-07-24). A standing
  constraint on new writing from PR 4 onward, plus a final pass.
- **Self-reinforcing loop** (user, 2026-07-24): use generates context. On
  `approved`, a `distill-review` effect diffs the machine draft against the
  human-approved text and proposes DRAFT glossary entries / style-guide
  amendments + eval-case candidates; humans approve them as content; prompt
  assembly already reads approved context, so the loop closes without new
  infrastructure. Eval corpus harvests approved triples; the qualityDelta
  trend is the loop's health metric. Automation proposes, never decides.
  Design alongside the package split; implement after e2e.

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

### Runtime and deploy (learned in PR 4, against the real project)

- **`drainEffects` has no claim-count knob** — it drains every claimable
  effect on one instance, serially. Backpressure is instead a property of the
  definitions: each holds ≤1 pending effect at any lifecycle point,
  bench-proven in `pendingEffects.test.ts`. A drain invocation is therefore
  ≤1 AI call by construction.
- **Scheduled Functions deploy only to organization-scoped stacks**
  (`sanity blueprints promote`); `sanity init` creates project-scoped ones.
  The heartbeat is opt-in (commented resource in the blueprint); the pipeline
  runs without it because `start-localization` ticks on every publish.
- The deploy CLI's blueprint parser (0.22) **refuses the `expression`
  schedule shape** the 0.12.2 authoring lib emits — use explicit cron fields.
- The instance's terminal marker is **`completedAt`** ("stamped on entry into
  any terminal stage, aborts included"), not `terminatedAt`/`abortedAt`.
- The eval suite is **single-sample and live-model**: consecutive runs fail
  different marginal cases with byte-identical prompt-assembly code. Treat a
  red eval as "diff the eval path first"; robustness work is tracked.
- **Release perspective in Studio navigation is a sticky router search
  param** (`STICKY_PARAMS`), not an intent param — navigate via
  `resolveIntentLink('edit', params, [['perspective', releaseId]])`, the same
  shape core's copy-document-url uses. And it takes the release **name**
  (`summer`), not the title ("Summer Campaign") — `useEditState`'s version
  param likewise. Feeding a title silently reads a nonexistent version.

### Perspectives (learned in PR 6a, bench-proven)

- `startInstance({perspective})` scopes **every** content read the instance makes,
  including how `$fields.subject` is hydrated for conditions — not just the
  field-entry queries and spawn `forEach` reads the type docs mention. The
  default is `DEFAULT_CONTENT_PERSPECTIVE = 'drafts'`.
- Proof: under `'published'` a draft-only write leaves `$fields.subject._rev`
  and `.name` unmoved; under the default both move
  (`localizeDocument.fieldTier.test.ts`).
- Consequence for the field tier: its locale children patch the subject's own
  draft, so a run started under the default reports its own output as source
  drift. `startPerspectiveFor(type)` (`core/fieldTier.ts`) is the single place
  that decision is made — the `start-localization` Function passes it.
- A handler that records a revision the engine later compares **must read under
  `instance.perspective ?? 'drafts'`** — `readSubjectDocument()`. Reading the
  other layer makes `analyzedRev` unmatchable and `sourceChanged` permanently
  true. The perspective is a plain top-level field on the instance:
  `*[_id == $instanceId][0].perspective`.
- **`@sanity/workflow-studio-plugin`'s Start action has no perspective hook** —
  only `perspectiveField`, which seeds a `release.ref` from Studio's selected
  release. A `person` run started from the Studio's own picker therefore gets
  the drafts default and the false positive returns — the case
  `localizeDocument.fieldTier.test.ts` already bench-proves.
- **And the picker cannot be hidden for one type.** `discoverWorkflowMappings`
  derives a row for every schema type the definition's `subject` entry accepts
  and then _merges_ `config.mappings` in by `docType::definition` key — an
  override customizes a discovered row, it never removes one. The only other
  lever, `startKindOf`, is per **definition**, so hiding `person` would hide
  `article` too. PR 6b therefore states the limitation in the UI rather than
  pretending it away: `LocalizationRun` rewords the `sourceChanged` banner when
  a field-tier run's `instance.perspective` is not `published`.
- Two stages of one definition may each declare a guard and both deploy; the
  names must differ. Exiting a stage deletes its guard document as the next
  stage's is created, so `translating → review` hands the publish hold over with
  no gap.

### Document actions (learned in PR 6b)

- **The Studio plugin already turns guards into disabled document actions.**
  `withWorkflowLock` wraps every action whose `action` is in `LOCKABLE_ACTIONS`
  — `publish`, `unpublish`, `delete` — evaluates the live instances' guards
  through `documentActionDenials`, and disables with the guard's title. A
  hand-rolled publish gate on top of that is duplicate machinery.
- **`schedule` is not in that map.** It is the one way a source can leave
  mid-run, and it is the only action `createLocalizationScheduleGate` wraps.
  Sanity's core injects `schedule` _after_ plugins resolve, so the wrap has to
  live in `sanity.config.ts` rather than in the l10n plugin.

### Agent Actions (verified live in PR 6a)

- `translate()` accepts `target: TranslateTarget[]`, and **disjoint roots
  coalesce into one request**: `bio`, `seo.metaTitle` and `seo.metaDescription`
  came back translated in place at the same `_key`s from a single call, with
  untargeted fields (`name`) untouched. That is one AI call per locale for the
  whole field tier, not one per field.
- Omitting `targetDocument` makes the source document the target — the
  documented default, and the only shape that works for in-place translation.
  `buildTranslateParams({inPlace: true})` emits it.

### Write-path revisions (learned shipping machineRev)

- `client.action` for `sanity.action.document.version.create` returns only
  `{transactionId}` — no `_rev`. The transaction id **is** the resulting
  revision (Content Lake `_rev` = last transaction id); this repo already
  treats them as one identifier space (`previousRevision()` feeds
  transaction-log ids into `?revision=`). Note the test fake mints
  `transactionId` independently of its `bumpRev()`, so the equivalence does
  not hold under `@sanity-labs/client-fake-for-test`.
- Reading a **literal** `drafts.<id>` / `versions.<release>.<id>` id needs
  `perspective: 'raw'` — under any resolving perspective (client default
  `drafts`), `_id == $literalId` silently matches nothing.

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

### PR 4 — effect handlers + runtime Functions — DONE (as built)

- Handlers live in `packages/l10n/src/effects/` (`@starter/l10n/handlers`),
  React-free, keyed by the constants in `workflows/effects.ts`.
  `translate-locale` calls `buildTranslateParams()` at
  `handlers/translateLocale.ts:102` — the same call shape as the eval, with a
  unit test pinning the argument object so the paths cannot drift.
- `analyze-source` diffs the publish against the source's previous revision
  (History transaction log); on `refresh-from-source` re-entry it diffs
  against `analyzedRev`. `targetLocales` = all configured `l10n.locale` codes
  minus source, computed in code: missing translations always included,
  existing ones only when the diff warrants. A new `explanation` field on
  `localize-document` (v2, deployed) carries the analysis summary.
- `translate-locale` branches on `release` (draft vs version-into-release),
  keeps `noWrite: true` and writes itself so `postProcessTranslation`
  (slug/image handling, moved to `@starter/l10n/translate`) stays in the
  path, and links `translation.metadata` for first-time locales (keyed by
  locale, idempotent).
- Idempotency: `ctx.effectKey` checked against `effectHistory[]` before AI
  calls; deterministic target ids; `publish-release` guards on the release's
  own state.
- Runtime Functions: `drain-effects` (filter `count(pendingEffects) > 0`,
  drain + tick), `start-localization` (deterministic
  `instanceId = <tag>.wf-instance.<sha256(id:_rev)[:16]>`; on
  `StartNotAllowedError` → `instancesForDocument` → `tick`, which is what
  makes `sourceChanged` observable), `handle-deleted-subject` (sequential
  aborts, failures collected and thrown), `heartbeat` (built; blueprint
  resource commented — see §3 org-scope constraint).
- Deleted: `mark-translations-stale` (146), `analyze-stale-translations`
  (508) and their blueprint resources. `person` is deferred to PR 6.
- Backpressure is the bench-proven ≤1-pending-effect invariant (§3), not a
  claim knob. `effectLeaseMs: 150_000` clears the 120s Function timeout.

Verified: 275 unit/bench tests, typecheck/lint/format clean, definitions v2
and three Functions deployed live. Eval: unstable at single-sample precision
(§3) — the seam is instead pinned by the handler's argument test.

### PR 5 — Studio and dashboard surfaces — DONE (as built)

Landed as four commits: prep/dead code (`250bf89`), Studio + schema
(`db36448`), dashboard (`dee5115`), skills truth-pass (`fe55583`).

- Inspector rebuilt on `useWorkflowSession`/`useDocumentWorkflows`
  (`translations/LocalizationRun.tsx`, `ReviewActions.tsx`,
  `TranslationCompare.tsx`). Compare targets the engine-written draft or
  release version vs published; jump-to-edit carries the release perspective
  as a sticky router search param. Per-locale rows merge `targetLocales` with
  `subworkflows` (newest visit per `rowKey`; success lives in
  `resolved.stage`). `sourceChanged`/`hasFailedLocales` surface, never block.
  `request-changes` locale picker defaults all-checked.
- Dashboard status derives from run stage in one tested pure function
  (`lib/localizationRun.ts`); batch = engine runs (drafts → N
  `localize-document`; release → one `localize-campaign` with minted
  release); duplicate-run pre-check with skip/take-over; `/runs/:instanceId`
  renders `WorkflowDiagram` + live child stages.
- Deleted beyond the §5a plan: **8,842 LOC of unreachable dashboard code**
  (75 files orphaned by an earlier reroute — five of the "six duplicated
  pipelines" were already dead). The live dashboard translate path had never
  sent glossaries or style guides; the engine path is what makes the quality
  claim true at runtime.
- **User rulings mid-PR**: no pre-translation locale picking in the Studio
  (analysis picks, review corrects — re-ratifies no-start-inputs); jump must
  cover release versions, not just drafts; multi-select batch buttons and
  the status-segment progress bar stay deleted (their verbs were the dead
  pipelines).
- **Field tier deferred to PR 6** (deviation from the original §5a split):
  `useFieldTranslateActions`, `deriveFieldCellStates`, `useStaleSyncEffect`,
  `createSemaphore`, and the `fieldTranslation.metadata` workflow half keep
  working until their engine replacement exists.
- Demo cost: fresh imports show no canned doc-tier statuses — run state is
  real now. A seed step that starts real runs is the honest fix if wanted.
- The two internals-guesses are resolved: the schedule gate matches the
  public `action.action === 'schedule'` discriminant; the badge-by-exclusion
  filter is pinned by a unit test (`plugin.test.ts`).

### PR 6a — field tier, engine and runtime — DONE (as built)

`person`'s three internationalized fields (`bio`, `seo.metaTitle`,
`seo.metaDescription`) run on the same three definitions. Only the handler's
write target and two structural fixes differ.

- `core/fieldTier.ts` is the registry and the tier's whole vocabulary: which
  fields a type localizes, the ancestor objects a patch needs, coverage
  derivation, the source projection, and `startPerspectiveFor`. Static for the
  same reason `SOURCE_LANGUAGE` is — a handler has no compiled Studio schema.
- `translate-locale` branches: `translateIntoSibling` (unchanged document tier)
  vs `translateInPlace`. In place is **one** AI call naming every source entry
  as a target, then one `tx.patch` per field —
  `setIfMissing → unset(language) → append` — against the subject's draft or
  release version. Concurrent siblings are safe: per-document exclusive
  transaction lock, no `ifRevisionID`. No `translation.metadata`, no
  `postProcessTranslation`, no `languageFieldPath`.
- `analyze-source` derives coverage from the arrays (a locale counts only when
  **every** field carries it) and diffs the **source-locale projection** of two
  revisions. Diffing whole documents cannot work when the translations live in
  the subject: an approved run's own publish would read as a material edit and
  restart itself forever.
- `sourceChanged` is fixed by starting field-tier runs under a `published`
  perspective (see §3) rather than by weakening the trigger.
- The publish guard now covers `translating` as well as `review`, so a subject
  cannot be published mid-fan-out. It holds document-tier sources for the same
  window — accepted.
- Blueprint: `start-localization` filters
  `(_type == 'article' && language == 'en-US') || _type == 'person'`;
  `handle-deleted-subject` filters `_type in ['article', 'person']`.

Verified: 322 unit/bench tests, eval green, typecheck/lint/format clean,
`deploy --check` passes, Functions build. Nothing deployed.

### PR 6b — field tier, Studio surfaces — DONE (as built)

The field tier now has no UI of its own. It renders the same run the document
tier does. **20 files and 3,280 lines** were deleted outright (3,783 deleted
lines across the whole change, net −3,073).

- **The field × locale matrix is gone.** `TranslationInspector` routes `person`
  to `FieldTierContent`, which is `LocalizationRun` in the shared
  `InspectorFrame` plus a coverage card derived with `coveredLocales` — no
  second status vocabulary, no cell verbs. Per-locale rows, stages, progress,
  compare and jump all come from the doc-tier components unchanged.
- **One compare, two tiers.** `TranslationCompare` takes an optional `locale`;
  `compareSides` (pure, six specs) decides what the two sides are. The document
  tier diffs two documents. The field tier reduces both the published and the
  pending copy of the _same_ document to that locale's values with
  `sourceProjection`, so `computeFieldChanges` and the diff components need no
  change. Jump-to-edit reads the entry's `_key` off the pending document —
  the handler commits with `autoGenerateArrayKeys`, so the key is not the
  locale and cannot be derived.
- **The publish gate was deleted, not rewritten.** The Studio plugin already
  disables `publish` from the run's own guard (§3, document actions). What was
  missing is `schedule`: `createLocalizationScheduleGate` disables it while any
  run is open, with the stage as the reason, and now covers `article` too —
  the doc tier had the same hole.
- **The AI Assist translate field action is gone** (`useTranslateFieldAction`,
  `useInternationalizedFields`, `useTranslate`, `useTranslationContext`, −480).
  It was the last path that assembled translation context without
  `buildTranslateParams` and wrote without review. `assist()` stays registered
  for everything else it does.
- **Studio-picker perspective gap: stated, not hidden.** The picker cannot be
  hidden for one type (§3), so `LocalizationRun` reads `instance.perspective`
  and, for a field-tier run not reading `published`, replaces the
  `sourceChanged` banner with one that says the run cannot tell its own writes
  from a source edit. `sanity.config.ts` names both mappings explicitly and
  gives `article` a `perspectiveField` so a picker start honours the release the
  editor has selected; `person` deliberately gets none, because a release-scoped
  field-tier run reads the very version its children write.
- **Bug found and fixed in PR 5's code, not just carried forward.**
  `liveChildInstanceIds` fed the child-instance subscription only rows without
  `resolved`. But the engine stamps `resolved` precisely when a child goes
  terminal, and that stamp is what lets the parent leave `translating` — so by
  the time a reviewer opens the run in `review`, no child is fetched, no row has
  a `target`, and neither tier renders a compare at all. It is now
  `childInstanceIds` (every row), with the reason pinned by two specs.
- Seeds: `fieldTranslation.metadata` is out of `briefs.ts`,
  `generate-sample-data.ts` and `sample-data.ndjson` (4 documents). The
  translated bios stay — they are content;
  `buildFieldTranslationBriefs` is now `buildPersonBioBriefs` and returns only
  those.

---

## 5a. The deletion inventory

The point of the migration. Measured, not estimated — `wc -l` at the time of
writing. **Status: complete.** PR 4 removed the Functions; PR 5 removed the doc
tier (plus 8,842 LOC of unreachable dashboard code the inventory never counted);
PR 6b removed every remaining row — `useFieldTranslateActions`,
`deriveFieldCellStates`, `useStaleSyncEffect`, `createSemaphore` and the whole of
`fieldTranslationMetadata`, not just its workflow half, since the content half
had no reader left either.

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
pnpm --filter @starter/l10n test     # 312 tests; the bench suite is the design gate
pnpm --filter l10n eval              # quality gate — needs credentials (PR 4 onward)
pnpm typecheck                       # from the ROOT: `pretypecheck` runs typegen.
                                     # `pnpm -r typecheck` skips it and checks stale types
pnpm lint                            # 0 errors, 0 warnings
npx oxfmt --check .
pnpm exec sanity-workflows deploy --check   # from PR 3; `--dry-run` diffs deployed state
```

`pnpm -r test` suppresses output on success — a silent pass is a pass. Confirm by
passing a bogus flag if you doubt it; it reaches vitest.
