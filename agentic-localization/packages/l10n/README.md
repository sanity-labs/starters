# @starter/l10n

The node floor of the localization pattern: primitives, prompt assembly, the
workflow definitions, and the effect handlers that satisfy them.

Nothing here imports `react`, `sanity`, `@sanity/ui`, `@sanity/icons` or
`styled-components` — not even in type position — so every entry costs the same
inside a Sanity Function, the workflow CLI or a frontend as it does in the
Studio. Two guards enforce that rather than asking you to remember it: an eslint
zone over `src/**` ([`eslint.config.mjs`](../../eslint.config.mjs)) and
[`src/exports.test.ts`](./src/exports.test.ts), which bundles each entry with
rolldown and asserts on the resolved module ids.

Studio UI lives in [`@starter/l10n-studio`](../l10n-studio).

## Entries

Four, each an explicit barrel. There are no deep imports — if something is not on
a barrel, it is internal.

### `@starter/l10n` — primitives

| Export                                                                                                                                           | What it is                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `localeTypeName`, `glossaryTypeName`, `styleGuideTypeName`, `glossaryEntryTypeName`, `languageFieldName`                                         | Schema type and field names, so a query and a schema cannot drift                        |
| `resolveConfig`, `TranslationsConfig`, `ResolvedTranslationsConfig`                                                                              | Plugin configuration and its defaults                                                    |
| `TranslationStatus`, `TranslationWorkflowStatus`, `TranslationInFlightStatus`                                                                    | The status vocabulary every surface renders                                              |
| `getStatusDisplay` → `StatusDisplay`                                                                                                             | Status → icon **name**, tone, label, tooltip. The surface binds the name to a component  |
| `isValidLocale`, `getFlagFromCode`, `regionToFlag`, `resolveLocaleDefaults`                                                                      | BCP-47 handling via `Intl`, no data source                                               |
| `uniqueLocaleValidator`, `prepareGlossary`, `prepareGlossaryEntry`                                                                               | Schema validators and preview builders                                                   |
| `internationalizedFields`, `fieldTierTypes`, `isFieldTier`, `entriesOf`, `entryFor`, `coveredLocales`, `sourceProjection`, `startPerspectiveFor` | The field-level tier: which types localize in place, and how to read them                |
| `computeFieldChanges`, `computeMagnitude`, `detectFieldType`                                                                                     | What changed between two revisions, and how much it matters                              |
| `buildFieldSummary`, `buildDiffAwareExtract`, `extractBlockText`, `ANALYSIS_PROMPT_INSTRUCTION`                                                  | The change summary and system prompt behind stale analysis                               |
| `compareSides`                                                                                                                                   | Source/target reduction behind the review diff                                           |
| `readDocumentId`, `readFlag`, `readLocaleRequests`, `readMateriality`, `readProgress`, `readReleaseName`, `readText`                             | Typed reads over a workflow instance's fields                                            |
| `buildLocaleRuns`, `childInstanceIds`, `toChildRun`                                                                                              | A run tree projected into per-locale rows                                                |
| `getTranslationMetadataId`                                                                                                                       | Deterministic `translation.metadata` id — the same input always yields the same document |
| `sanitizeTranslationValue`                                                                                                                       | Strips what a model should not have returned, before it reaches the Content Lake         |
| `InternationalizedArrayItem`, `TranslationReference`, `LocalizedObject`                                                                          | The `internationalizedArray` shapes, declared here so the floor holds (see below)        |

### `@starter/l10n/prompts` — prompt assembly

The starter's hypothesis in code: context stored as structured content measurably
improves translations.

| Export                                                                                                                                                            | What it is                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `buildTranslateParams`                                                                                                                                            | Returns a `TranslateDocument` — hand it to `client.agent.action.translate()` unchanged |
| `assembleStyleGuide`, `buildGlossarySection`, `buildStyleGuideSection`                                                                                            | The assembled prompt, and each section on its own for testing                          |
| `filterGlossaryByContent`, `extractProtectedPhrases`, `extractDocumentText`                                                                                       | Narrowing a glossary to the terms a document actually contains                         |
| `measureStyleGuide`, `STYLE_GUIDE_WARN_THRESHOLD`                                                                                                                 | Size budget for the assembled guide                                                    |
| `GLOSSARIES_QUERY`, `STYLE_GUIDE_FOR_LOCALE_QUERY`, `SUPPORTED_LANGUAGES_QUERY`, `LOCALES_BY_CODE_QUERY`, `LOCALE_CODES_QUERY`, `TRANSLATIONS_FOR_DOCUMENT_QUERY` | The GROQ reads that supply it                                                          |

### `@starter/l10n/workflows` — the definitions

| Export                                                                  | What it is                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `localizationWorkflows`                                                 | All three, in dependency order. Deploy takes the whole set in one call |
| `localizeCampaign`, `localizeDocument`, `localizeLocale`                | The definitions individually                                           |
| `ANALYZE_SOURCE`, `TRANSLATE_LOCALE`, `PUBLISH_RELEASE`, `EFFECT_NAMES` | Effect names — a registry key, unique per definition                   |
| `WORKFLOW_TAG`, `WORKFLOWS_DATASET`                                     | The engine coordinates. A mismatch reads an empty partition            |

### `@starter/l10n/effects` — the handlers

| Export                                                                          | What it is                                                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `localizationEffectHandlers`                                                    | The map. Pass to `createEngine({effectHandlers})`                                                         |
| `analyzeSource`, `translateLocale`, `publishRelease`                            | Each handler, for composing a map of your own                                                             |
| `contentClientFor`, `agentClient`, `readSubjectDocument`, `instancePerspective` | Client routing. `ctx.client` addresses the workflows dataset only — content traffic must go through these |
| `requireGdr`, `requireString`, `optionalString`, `optionalRelease`, `isGdrUri`  | Effect param narrowing                                                                                    |
| `siblingGdr`, `datasetOf`                                                       | GDR arithmetic                                                                                            |
| `effectAlreadyDone`                                                             | The at-least-once idempotency read. Call it before spending an AI call                                    |
| `ContentClient`, `EffectContext`, `AGENT_API_VERSION`                           | The types and constants the above are expressed in                                                        |

## Build your own workflow

`./workflows` and `./effects` are an extension surface, not just this starter's
internals. To localize something the shipped definitions do not cover:

1. **Write the definition** against `@sanity/workflow-engine/define`. Name your
   effects; an effect name is a registry key and must be unique per definition.
2. **Prove it on the bench before deploying.** `createBench` from
   `@sanity/workflow-engine-test` runs the real engine in memory on a
   deterministic clock, with no project and no network. Every definition here has
   a sibling `*.test.ts` doing this — start from
   [`pendingEffects.test.ts`](./src/workflows/pendingEffects.test.ts), which
   asserts the invariant the whole runtime rests on: no instance ever holds more
   than one pending effect, so a drain is worth at most one AI call.
3. **Satisfy the effects.** Reuse a handler, wrap one, or write your own on the
   `effectRuntime` helpers above — client routing, param narrowing, GDR
   arithmetic and the idempotency read are the parts that are easy to get subtly
   wrong.
4. **Register and deploy.** Add the definition to the deploy set
   (`sanity.workflow.ts`) and the handler to the map the drain Function passes
   (`functions/drain-effects`). A parent cannot spawn a child that is not
   deployed.

Engine behaviour the official docs do not cover — cohort `status` meaning
_settled_ rather than _succeeded_, `current` going false once a spawning stage is
exited, triggers firing at most once per stage visit — is recorded in
[`docs/WORKFLOW_ENGINE_MIGRATION.md` §3](../../docs/WORKFLOW_ENGINE_MIGRATION.md).
Read it before writing a definition; every item there cost real time.

## Why two types are declared here

`InternationalizedArrayItem` and `TranslationReference` are owned upstream by
`sanity-plugin-internationalized-array` and
`@sanity/document-internationalization`. Both plugins are Studio-only, and an
effect handler has to read and write those shapes from inside a Function — so
they are re-declared in [`src/core/types.ts`](./src/core/types.ts). A
bidirectional assignability test in `@starter/l10n-studio` (the only package that
depends on both) fails `typecheck` if the two ever drift.

## Tests and evals

```sh
pnpm test   # unit tests, bench suites, and the bundle-shape assertion
pnpm eval   # live model evals via Agent Actions — consumes AI credits
```

Evals live in [`src/prompts/evals/`](./src/prompts/evals), next to the assembly
they measure. They need `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` (repo
root `.env`) plus a `SANITY_AUTH_TOKEN` in `packages/l10n/.env` (gitignored — copy
`.env.example`); a `sanity login` session token is the fallback. Each case draws
three translations per arm and asserts on the aggregate, because a single
live-model draw is too noisy to gate on. `EVAL_SAMPLES` draws more.
