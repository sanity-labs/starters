# Architecture

## Monorepo Layout

```
starter-agentic-i18n/
├── sanity.blueprint.ts           Infrastructure-as-code (dataset, robot token, functions)
├── .env.local                    Single source for all env vars (all workspaces read this)
├── docs/I18N_RESEARCH.md         Gap analysis: enterprise TMS vs AI translation APIs
│
├── packages/l10n/                @starter/l10n — the node floor. Zero react,
│   │                             sanity, @sanity/ui, @sanity/icons or
│   │                             styled-components anywhere in its graph
│   ├── src/
│   │   ├── index.ts              Entry `.` — the core primitives barrel
│   │   ├── exports.test.ts       Bundles each entry with rolldown, asserts the
│   │   │                         resolved module ids stay Studio-free
│   │   ├── core/                 The primitives themselves
│   │   │   ├── typeNames.ts             Schema type and field name constants
│   │   │   ├── types.ts                 Config, statuses, stale analysis, array shapes
│   │   │   ├── utils.ts                 Intl locale utilities, validators, previews
│   │   │   ├── getStatusDisplay.ts      Status → icon NAME + tone + label
│   │   │   ├── fieldTier.ts             Field-tier registry, coverage, source projection
│   │   │   ├── ids.ts                   Deterministic translation.metadata IDs
│   │   │   ├── computeFieldChanges.ts   Field-level diffing
│   │   │   ├── buildFieldSummary.ts     Human-readable change summary for AI
│   │   │   ├── extractBlockText.ts      Plain text from Portable Text
│   │   │   ├── staleAnalysisPrompt.ts   System prompt for change analysis
│   │   │   ├── sanitizeTranslationValue.ts  Clean AI output before write
│   │   │   ├── compareSides.ts          Source/target reduction for the review diff
│   │   │   ├── instanceFields.ts        Typed reads over a workflow instance
│   │   │   └── localeRuns.ts            A run tree projected into per-locale rows
│   │   ├── prompts/              Entry `./prompts`
│   │   │   ├── promptAssembly.ts        The assembly pipeline (the main bridge)
│   │   │   ├── queries.ts               GROQ for locales, glossaries, style guides
│   │   │   └── evals/                   Translation quality evals, beside what they measure
│   │   │       ├── fixtures.ts          Shared test data (locales, glossaries, texts)
│   │   │       ├── scoring.ts           Deterministic scoring (term presence/patterns)
│   │   │       ├── judge.ts             LLM-as-judge (4 dimensions × weights, 3 trials)
│   │   │       ├── model-scoring.ts     Combined scoring + baseline comparison
│   │   │       ├── translate.ts         Calls Agent Actions Translate (noWrite: true)
│   │   │       ├── authToken.ts         Resolves Sanity auth token for evals
│   │   │       └── setup.ts             Global setup/teardown (seeds eval source doc)
│   │   ├── workflows/            Entry `./workflows` — definitions + bench specs
│   │   │   ├── effectDispatch.test.ts   Proves only drainEffects reaches a handler
│   │   │   └── pendingEffects.test.ts   Proves one pending effect per instance, ever
│   │   ├── effects/              Entry `./effects` — the handlers, plus effectRuntime
│   │   │   └── effectRuntime.ts         Client routing, param narrowing, idempotency
│   │   └── translate/            Internal: post-translation shaping (slugs, images)
│   │
├── packages/l10n-studio/         @starter/l10n-studio — the Studio surface. The
│   │                             only layer allowed react/sanity/@sanity/ui
│   ├── src/
│   │   ├── index.ts              Entry `.` — createL10n(), the pane, hooks
│   │   ├── plugin.ts             definePlugin: schemas, i18n, navbar, inspector
│   │   ├── structure.ts          withLocaleFilter
│   │   ├── internationalizedArrayContract.test.ts
│   │   │                         Type-level: l10n's array shapes vs the plugins' own
│   │   ├── schemas/              Entry `./schemas` — defineType from @sanity/types
│   │   │   ├── translationLocale.ts        l10n.locale
│   │   │   ├── translationGlossary.ts      l10n.glossary
│   │   │   ├── glossaryEntry.ts            l10n.glossary.entry (object)
│   │   │   ├── translationStyleGuide.ts    l10n.styleGuide
│   │   │   ├── localeTranslation.ts        l10n.glossary.entry.translation (object)
│   │   │   └── languageField.ts            injectLanguageField + async validator
│   │   ├── L10nProvider.tsx      One listenQuery each for locales and glossaries,
│   │   │                         mounted once at the studio layout
│   │   └── translations/         React UI: translation pane, inspector, hooks
│   │       ├── TranslationInspector.tsx        Tier switch: document or field
│   │       ├── FieldTierContent.tsx            Field-tier inspector: run + coverage
│   │       ├── LocalizationRun.tsx             The open run, read off the instance
│   │       ├── workflowEngine.ts               Engine client, instance lookup
│   │       ├── scheduleGate.ts                 Holds `schedule` while a run is open
│   │       └── ...                             (other doc-level translation files)
│
├── sanity.workflow.ts            Workflow definition deployment (dataset + tag)
├── functions/                    The engine's runtime (serverless)
│   ├── drain-effects/                Dispatch an instance's pending effects, then tick
│   ├── start-localization/           Publish starts or ticks a run
│   ├── handle-deleted-subject/       Abort runs whose subject is gone
│   └── heartbeat/                    Opt-in sweep for orphaned effect claims
│
├── studio/                       Sanity Studio workspace
│   ├── sanity.config.ts          Plugin config, localizedSchemaTypes list
│   ├── schemaTypes/              Article, person, topic, tag
│   └── migrations/               Deterministic locale seeding
│
├── apps/
│   ├── translations-dashboard/   Real-time overview (Sanity App SDK)
│   └── frontend/                 Next.js frontend with path-based i18n routing
│       └── src/app/[lang]/       Locale-parameterized routes
│
└── packages/
    ├── @starter/eslint-config/   Shared ESLint config
    └── @starter/tsconfig/        Shared tsconfig base
```

## Package Entries

Two packages, six entries. The split is the React boundary: everything in
`@starter/l10n` is safe in a Function, the CLI or a frontend; everything in
`@starter/l10n-studio` needs a Studio.

| Import path                    | Contents                                                                                                                                  | Studio-free? |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `@starter/l10n`                | Type names, config, statuses, `getStatusDisplay`, locale utilities, field tier, diffing, instance readers, locale runs, ids, sanitization | Yes          |
| `@starter/l10n/prompts`        | Assembly pipeline, its types, and the GROQ queries that feed it                                                                           | Yes          |
| `@starter/l10n/workflows`      | Definitions, effect names, engine coordinates                                                                                             | Yes          |
| `@starter/l10n/effects`        | Effect handlers, plus the `effectRuntime` helpers for writing your own                                                                    | Yes          |
| `@starter/l10n-studio`         | `createL10n`, `withLocaleFilter`, the Translations pane, hooks, engine wiring                                                             | No           |
| `@starter/l10n-studio/schemas` | The five schema types + `injectLanguageField`                                                                                             | No           |

Each entry is an explicit barrel; there are no deep imports, and an import not on
a barrel is internal. `package.json` `exports` is the authoritative list.

Two guards keep the boundary honest rather than relying on discipline:

- **eslint zone** — `eslint.config.mjs` bans `react`, `react-dom`, `sanity`,
  `sanity/*`, `@sanity/ui`, `@sanity/icons` and `styled-components` under
  `packages/l10n/src/**` with `allowTypeImports: false`. Type-only counts: a type
  import still requires the package to be installed, which puts it back in the
  dependency graph.
- **`packages/l10n/src/exports.test.ts`** — bundles each of the four entries with
  rolldown and asserts no resolved module id sits under those packages. Module
  ids, not a grep over minified output.

`@starter/l10n` also declares `InternationalizedArrayItem` and
`TranslationReference` itself, because the plugins that own them are Studio-only
and effect handlers need those shapes inside a Function.
`packages/l10n-studio/src/internationalizedArrayContract.test.ts` holds the two
declarations together at type level.

## Document-Level Localization Runs

The engine owns this flow, not the repo. Read the definitions in
`packages/l10n/src/workflows/` for what a run does, `packages/l10n/src/effects/`
for what each effect executes, `functions/` for what dispatches them, and
`docs/WORKFLOW_ENGINE_MIGRATION.md` for engine behaviour verified empirically.

## Data Flow: Prompt Assembly Pipeline

```
Source document + target locale
        │
        ▼
extractDocumentText(document)          Extract all human-readable text
        │
        ▼
filterGlossaryByContent(glossaries, doc)   Prune to relevant terms
        │
        ▼
assembleStyleGuide(glossaries, locale, styleGuide?)
  │  ├── buildGlossarySection()        Approved / DNT / Forbidden terms
  │  └── buildStyleGuideSection()      Formality, tone, instructions
  │
  ▼
buildTranslateParams(options)
  │  ├── assembleStyleGuide()          → styleGuide string
  │  ├── extractProtectedPhrases()     → protectedPhrases array
  │  └── measureStyleGuide()           → warns if > 12,000 chars
  │
  ▼
Agent Actions Translate API call
```

## Schema Types

| Type name                 | Kind     | Key fields                                                                      | Source                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| `l10n.locale`             | document | code (BCP-47), title, nativeName, fallback (ref)                                | `schemas/translationLocale.tsx`    |
| `l10n.glossary`           | document | title, sourceLocale (ref), entries[]                                            | `schemas/translationGlossary.ts`   |
| `l10n.glossary.entry`     | object   | term, status, doNotTranslate, partOfSpeech, definition, context, translations[] | `schemas/glossaryEntry.ts`         |
| `l10n.style-guide`        | document | title, locale (ref), formality, tone[], additionalInstructions (PT)             | `schemas/translationStyleGuide.ts` |
| `l10n.locale.translation` | object   | locale (ref), translation, gender                                               | `schemas/localeTranslation.ts`     |

## GROQ Queries

| Export                         | Returns                                                | Used by                                   |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------- |
| `SUPPORTED_LANGUAGES_QUERY`    | `{id, title}[]` — all locales, ordered by title        | `LocalesContext` (single subscription)    |
| `GLOSSARIES_QUERY`             | Glossaries with resolved entries + locale translations | `GlossariesContext` (single subscription) |
| `STYLE_GUIDE_FOR_LOCALE_QUERY` | Style guide for a specific `$localeCode`, or null      | Translation inspector, prompt assembly    |

## Field-Level Localization Runs

Same three definitions as the document tier — only the write target differs.
`packages/l10n/src/core/fieldTier.ts` is the tier's vocabulary and
`packages/l10n/src/effects/translateLocale.ts` holds the in-place branch. See
`references/field-level-patterns.md`.
