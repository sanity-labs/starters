# How the pattern works

The phases in order, what each one is responsible for, and where to read the
real thing. Nothing here restates a package README — read
[`packages/l10n/README.md`](../../../packages/l10n/README.md) and
[`packages/l10n-studio/README.md`](../../../packages/l10n-studio/README.md) for
export surfaces.

## 1. Context is content

Three document types carry everything a translator would be briefed with:

| Type              | Carries                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l10n.locale`     | BCP-47 code, native name, fallback locale                                                                                                                  |
| `l10n.glossary`   | Terms with status (approved / forbidden / provisional), do-not-translate flag, part of speech, definition, usage context, per-locale approved translations |
| `l10n.styleGuide` | One per locale: formality register, tone adjectives, free-form Portable Text instructions                                                                  |

Definitions: `packages/l10n-studio/src/schemas/`. Type-name constants:
`packages/l10n/src/core/typeNames.ts` — import them so a query and a schema
cannot drift.

Why content rather than prompt strings in code: editors own terminology, every
run reuses the same context, and a change takes effect without a deploy. The
cost is that context is now data you have to query, which is what phase 2 is.

## 2. Assembly

`packages/l10n/src/prompts/promptAssembly.ts` turns context into one Agent
Actions Translate request. The pipeline:

1. `extractDocumentText` — all human-readable text in the source document.
2. `filterGlossaryByContent` — prune to terms the document actually contains.
   A whole glossary in every prompt buries the terms that matter and burns
   tokens; do-not-translate and forbidden entries are always kept as guardrails.
3. `buildGlossarySection` / `buildStyleGuideSection` → `assembleStyleGuide` —
   one instruction string.
4. `extractProtectedPhrases` — do-not-translate terms lifted into the API's own
   `protectedPhrases`, which is a harder guarantee than an instruction.
5. `measureStyleGuide` — size budget; warns past `STYLE_GUIDE_WARN_THRESHOLD`.
6. `buildTranslateParams` — a `TranslateDocument` you hand to
   `client.agent.action.translate()` unchanged.

The GROQ that feeds it is exported alongside it (`queries.ts`), so the read and
the assembly stay in one place.

That the context measurably improves output is the starter's hypothesis, and it
is tested rather than asserted: `packages/l10n/src/prompts/evals/` translates
each case with and without context and scores the delta with deterministic
checks plus an LLM judge over multiple draws.

## 3. The run

Three workflow definitions in `packages/l10n/src/workflows/`, deployed as one
set because a parent cannot spawn a child that is not deployed:

| Definition          | Scope                                                               | Stages                                                                  |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `localize-campaign` | A batch shipped together as one Content Release                     | `assembly` → `ready` → `publishing` → `published`                       |
| `localize-document` | One source document across every locale, plus the human review pass | `analyzing` → `translating` → `review` → `approved` / `done` / `failed` |
| `localize-locale`   | One target locale of one document, machine-only                     | `translating` → `translated` / `failed`                                 |

What the engine gives you, so you never write it:

- **Stale analysis before spend.** `analyze-source` diffs the current revision
  against `analyzedRev`, decides `materiality`, and emits `targetLocales` with a
  reason per locale. A cosmetic edit transitions straight to `done`.
- **Fan-out.** The `fan-out` action spawns one `localize-locale` child per
  target locale. Concurrency and retries are the engine's, not a semaphore's.
- **Guards.** `localize-document` holds `publish` on its subject while
  translating and in review; `createLocalizationScheduleGate` closes `schedule`,
  which sits outside the Studio plugin's lock map.
- **Live source detection.** Publishing the source again ticks the open run, so
  the `source-changed` trigger fires and a reviewer can refresh from source
  rather than approve stale text.
- **Idempotency.** Effects are at-least-once. `effectAlreadyDone` is the read
  that keeps redelivery from costing a second AI call.

Effect names (`analyze-source`, `translate-locale`, `publish-release`) live in
`packages/l10n/src/workflows/effects.ts` because the definition and the handler
match on the literal; the engine resolves a handler by name alone.

## 4. Translate

Handlers in `packages/l10n/src/effects/` satisfy the declared effects.
`translateLocale.ts` is the one that spends: assemble, call Agent Actions
Translate, sanitize what comes back, write it. `translate()` takes an array of
targets and coalesces disjoint roots into one request, so a field-tier locale
costs one AI call for every field rather than one per field.

Two things a handler must get right, both provided by
`packages/l10n/src/effects/effectRuntime.ts`:

- **Client routing.** `ctx.client` addresses the workflows dataset only. Content
  traffic goes through `contentClientFor` / `agentClient`, and the instance's
  perspective decides whether a write lands on a draft or a release version.
- **Param narrowing.** Effect params arrive untyped; `requireGdr`,
  `requireString`, `optionalRelease` are the narrowing, and `siblingGdr` /
  `datasetOf` the GDR arithmetic.

`packages/l10n/src/translate/` holds what happens after the model returns —
localized slugs, image handling — and stays internal.

## 5. Review

`packages/l10n-studio/src/translations/` is the Translations inspector: the open
run read off the instance, per-locale rows, a source-versus-translation diff,
and the review actions. A reviewer can approve, request changes on named
locales, or refresh from a changed source.

The gate is not ceremony. It is where the pattern gets its training signal:
without a recorded human correction there is nothing to distill in phase 7.

## 6. Publish

Approval reaches the `approved` stage. A campaign instead collects its documents
and ships one Content Release, immediately or on a schedule, through
`publishRelease`.

## 7. Distill

An observer of finished runs, not a phase of them (see
[`docs/decisions/adr-002-learning-loop.md`](../../../docs/decisions/adr-002-learning-loop.md)):

1. `localize-locale` records `machineRev` at translate time — the one moment
   machine output is unambiguous.
2. When an instance reaches `approved`, the `distill-review` Function diffs that
   revision against the human-approved text through the History API.
3. A pure noise gate runs **before** any AI spend; one prompt call per run.
4. Output is **draft** `l10n.proposal` documents — glossary entries, style-guide
   rules, or eval cases.
5. A reviewer accepts or rejects. Accept patches the target glossary or
   style-guide draft; assembly reads only published, approved context, so two
   human acts stand between automation and a prompt.

Code: `packages/l10n/src/distill/`, `functions/distill-review/`, and the accept
action in `packages/l10n-studio/src/proposals/`.

## The runtime

The engine has no daemon. Four Sanity Functions are its runtime, declared as
blueprint resources, plus an opt-in scheduled `heartbeat` that ships built but
commented out — see [`docs/functions.md`](../../../docs/functions.md) for the
trigger-to-verb table. The load-bearing property: the definitions keep at
most one effect pending per instance, so one `drain-effects` invocation is at
most one AI call. `packages/l10n/src/workflows/pendingEffects.test.ts` proves it
on the bench.

## The two tiers

Both tiers run the _same_ three definitions. Only the write target differs.

| Aspect       | Document tier                                             | Field tier                                                                         |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Plugin       | `@sanity/document-internationalization`                   | `sanity-plugin-internationalized-array`                                            |
| Storage      | One document per locale, joined by `translation.metadata` | Language-keyed entries in `internationalizedArray` fields on one document          |
| Registered   | `localizedSchemaTypes` in `createL10n()`                  | `FIELD_TIER` in `packages/l10n/src/core/fieldTier.ts`                              |
| Write target | Sibling draft or release version                          | In-place patches on the subject itself                                             |
| Start        | Default perspective                                       | `published` perspective — a run must not read its own draft writes as source drift |
| Coverage     | Per-document existence                                    | All-or-nothing: every registered field must carry the locale                       |

Choose per type, deliberately, and expect to live with it: the tier is a storage
shape, not a setting. Changing it later means migrating stored values, creating or
deleting `translation.metadata` join documents, and rewriting every query and
frontend read of that type. Treat a tier change as a content migration.

The field-tier registry is static because an effect handler runs inside a
Function with no compiled Studio schema to walk. `startPerspectiveFor` and
`sourceProjection` in `fieldTier.ts` are why a field-tier run does not
self-trigger after approval;
`packages/l10n/src/workflows/localizeDocument.fieldTier.test.ts` holds that
invariant.

## Layer boundaries

| Layer                  | May import                              | Consumed by                                         |
| ---------------------- | --------------------------------------- | --------------------------------------------------- |
| `@starter/l10n`        | engine + stdlib only, no React/`sanity` | Functions, workflow CLI, evals, dashboard, frontend |
| `@starter/l10n-studio` | everything, plus `@starter/l10n`        | the Studio only                                     |

Two guards keep it honest instead of relying on memory: an eslint zone over
`packages/l10n/src/**` in [`eslint.config.mjs`](../../../eslint.config.mjs), and
`packages/l10n/src/exports.test.ts`, which bundles each entry with rolldown and
asserts on resolved module ids. This is not aesthetics: a Function inlines its
whole import graph.
