# Architecture

## Monorepo Layout

```
starter-agentic-i18n/
├── sanity.blueprint.ts           Infrastructure-as-code (dataset, robot token, functions)
├── .env.local                    Single source for all env vars (all workspaces read this)
├── docs/I18N_RESEARCH.md         Gap analysis: enterprise TMS vs AI translation APIs
│
├── packages/l10n/                @starter/l10n — the core plugin
│   ├── src/
│   │   ├── index.ts              createL10n(), injectLanguageField, withLocaleFilter
│   │   ├── promptAssembly.ts     Prompt assembly pipeline (the main bridge)
│   │   ├── queries.ts            GROQ queries for locales, glossaries, style guides
│   │   ├── types.ts              Schema type name constants
│   │   ├── workflows/            Definitions + bench specs, engine coordinates
│   │   ├── handlers/             Effect handlers those definitions declare
│   │   ├── core/                 Pure utilities (zero React — safe for serverless)
│   │   │   ├── types.ts          Workflow statuses, stale analysis types, config
│   │   │   ├── fieldTier.ts             Field-tier registry, coverage, source projection
│   │   │   ├── ids.ts                   Deterministic translation.metadata IDs
│   │   │   ├── computeFieldChanges.ts   Field-level diffing
│   │   │   ├── buildFieldSummary.ts     Human-readable change summary for AI
│   │   │   ├── extractBlockText.ts      Plain text from Portable Text
│   │   │   ├── staleAnalysisPrompt.ts   System prompt for change analysis
│   │   │   └── sanitizeTranslationValue.ts  Clean AI output before write
│   │   ├── schemas/              Sanity document/object type definitions
│   │   │   ├── translationLocale.tsx       l10n.locale
│   │   │   ├── translationGlossary.ts      l10n.glossary
│   │   │   ├── glossaryEntry.ts            l10n.glossary.entry (object)
│   │   │   ├── translationStyleGuide.ts    l10n.style-guide
│   │   │   └── localeTranslation.ts        l10n.locale.translation (object)
│   │   ├── L10nProvider.tsx      One listenQuery each for locales and glossaries,
│   │   │                         mounted once at the studio layout
│   │   └── translations/         React UI: translation pane, inspector, hooks
│   │       ├── TranslationInspector.tsx        Tier switch: document or field
│   │       ├── FieldTierContent.tsx            Field-tier inspector: run + coverage
│   │       ├── LocalizationRun.tsx             The open run, read off the instance
│   │       ├── workflowEngine.ts               Engine client, instance lookup
│   │       ├── scheduleGate.ts                 Holds `schedule` while a run is open
│   │       └── ...                             (other doc-level translation files)
│   └── evals/                    Translation quality evaluation framework
│       ├── fixtures.ts           Shared test data (locales, glossaries, source texts)
│       ├── scoring.ts            Deterministic scoring (term presence/absence/patterns)
│       ├── judge.ts              LLM-as-judge (4 dimensions × weights, 3 trials)
│       ├── model-scoring.ts      Combined scoring + baseline comparison
│       ├── translate.ts          Calls Agent Actions Translate (noWrite: true)
│       ├── authToken.ts          Resolves Sanity auth token for evals
│       └── setup.ts              Global setup/teardown (seeds eval source doc)
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

## Sub-Path Exports

The l10n package uses sub-path exports to maintain a React-free boundary for
serverless functions:

| Import path                                   | Contents                                                | React-free? |
| --------------------------------------------- | ------------------------------------------------------- | ----------- |
| `@starter/l10n`                               | `createL10n`, `injectLanguageField`, `withLocaleFilter` | No          |
| `@starter/l10n/promptAssembly`                | Assembly pipeline, types                                | Yes         |
| `@starter/l10n/queries`                       | GROQ query strings                                      | Yes         |
| `@starter/l10n/core`                          | All core utilities                                      | Yes         |
| `@starter/l10n/core/types`                    | Workflow statuses, analysis types                       | Yes         |
| `@starter/l10n/core/computeFieldChanges`      | Field-level diffing                                     | Yes         |
| `@starter/l10n/core/buildFieldSummary`        | Change summary for AI prompt                            | Yes         |
| `@starter/l10n/core/staleAnalysisPrompt`      | System prompt template                                  | Yes         |
| `@starter/l10n/core/sanitizeTranslationValue` | Clean AI output                                         | Yes         |
| `@starter/l10n/core/ids`                      | `getTranslationMetadataId` — deterministic IDs          | Yes         |
| `@starter/l10n/workflows`                     | Definitions, effect names, engine coordinates           | Yes         |
| `@starter/l10n/handlers`                      | Effect handlers + the runtime that dispatches them      | Yes         |
| `@starter/l10n/translate`                     | Post-translation processing (slugs, images)             | Yes         |

`package.json` `exports` is the authoritative list. Functions, the CLI and the
blueprint import the React-free sub-paths — never the root export.

## Document-Level Localization Runs

The engine owns this flow, not the repo. Read the definitions in
`packages/l10n/src/workflows/` for what a run does, `packages/l10n/src/handlers/`
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
`packages/l10n/src/handlers/translateLocale.ts` holds the in-place branch. See
`references/field-level-patterns.md`.
