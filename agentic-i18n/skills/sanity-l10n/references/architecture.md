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
│   │   ├── core/                 Pure utilities (zero React — safe for serverless)
│   │   │   ├── types.ts          Workflow statuses, stale analysis types, config
│   │   │   ├── computeFieldChanges.ts   Field-level diffing
│   │   │   ├── buildFieldSummary.ts     Human-readable change summary for AI
│   │   │   ├── extractBlockText.ts      Plain text from Portable Text
│   │   │   ├── staleAnalysisPrompt.ts   System prompt for change analysis
│   │   │   ├── staleAnalysisCache.ts    Cache helpers for metadata documents
│   │   │   └── sanitizeTranslationValue.ts  Clean AI output before write
│   │   ├── schemas/              Sanity document/object type definitions
│   │   │   ├── translationLocale.tsx       l10n.locale
│   │   │   ├── translationGlossary.ts      l10n.glossary
│   │   │   ├── glossaryEntry.ts            l10n.glossary.entry (object)
│   │   │   ├── translationStyleGuide.ts    l10n.style-guide
│   │   │   ├── localeTranslation.ts        l10n.locale.translation (object)
│   │   │   └── metadataFields.ts           translation.metadata fields
│   │   └── translations/         React UI: translation pane, inspector, hooks
│   └── evals/                    Translation quality evaluation framework
│       ├── fixtures.ts           Shared test data (locales, glossaries, source texts)
│       ├── scoring.ts            Deterministic scoring (term presence/absence/patterns)
│       ├── judge.ts              LLM-as-judge (4 dimensions × weights, 3 trials)
│       ├── model-scoring.ts      Combined scoring + baseline comparison
│       ├── translate.ts          Calls Agent Actions Translate (noWrite: true)
│       ├── authToken.ts          Resolves Sanity auth token for evals
│       └── setup.ts              Global setup/teardown (seeds eval source doc)
│
├── functions/                    Sanity Functions (serverless)
│   ├── mark-translations-stale.ts    Marks translations stale on source publish
│   └── analyze-stale-translations.ts AI analysis + pre-translation of stale fields
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
| `@starter/l10n/core/staleAnalysisCache`       | Cache read/write helpers                                | Yes         |
| `@starter/l10n/core/sanitizeTranslationValue` | Clean AI output                                         | Yes         |

Functions import from `@starter/l10n/core/*` and `@starter/l10n/promptAssembly`
— never from the root export (which pulls in React).

## Data Flow: Stale Detection Pipeline

```
Source doc published (language == 'en-US')
        │
        ▼
mark-translations-stale (Function)
  │  Finds translation.metadata for the doc
  │  Sets all workflow states → 'stale'
  │  Records staleSourceRev = published _rev
  │
  ▼
translation.metadata updated (stale count > 0)
        │
        ▼
analyze-stale-translations (Function)
  │  1. Guard: skip if valid cache exists for this staleSourceRev
  │  2. Fetch source doc ref from metadata
  │  3. Fetch historical doc (History API at sourceRevision) + current doc
  │  4. Compute field-level diff (computeFieldChanges)
  │  5. AI analysis via agent.action.prompt → StaleAnalysisResult
  │  6. Write analysis cache to metadata (phase 1)
  │  7. Pre-translate changed fields per stale locale (phase 2)
  │     └── Batched by LOCALE_BATCH_SIZE=3, uses per-locale style guides
  │
  ▼
Editor reviews in Translation Inspector
  │  Sees: explanation, materiality, per-field suggestions
  │  Actions: apply pre-translation, retranslate, dismiss, skip
```

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

| Export                         | Returns                                                | Used by                                |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| `SUPPORTED_LANGUAGES_QUERY`    | `{id, title}[]` — all locales, ordered by title        | Language selectors                     |
| `GLOSSARIES_QUERY`             | Glossaries with resolved entries + locale translations | Translation inspector, prompt assembly |
| `STYLE_GUIDE_FOR_LOCALE_QUERY` | Style guide for a specific `$localeCode`, or null      | Translation inspector, prompt assembly |
