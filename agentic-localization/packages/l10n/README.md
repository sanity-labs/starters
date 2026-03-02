# @starter/l10n

Sanity plugin for managing localization metadata — locales, glossaries, and style guides — and assembling them into structured prompts for the Agent Actions Translate API.

## What it provides

- **Schema types** — `l10n.locale`, `l10n.glossary`, `l10n.style-guide`, and supporting object types for glossary entries and locale translations
- **Prompt assembly** — `assembleStyleGuide()`, `filterGlossaryByContent()`, `buildTranslateParams()`, `extractProtectedPhrases()` to bridge structured metadata to the Translate API
- **Translation UI** — Translation pane, inspector, and hooks for reviewing and managing translations in the Studio
- **Core utilities** — Field diffing, stale analysis, Portable Text extraction, and cache helpers (React-free, safe for serverless via sub-path exports)

## Usage

```ts
import {createL10n, withLocaleFilter} from '@starter/l10n'

const l10n = createL10n({localizedSchemaTypes: ['article', 'tag']})
```

`createL10n()` returns:

- `plugin` — a Sanity plugin instance that registers l10n schema types, the translation pane, and the inspector
- `injectLanguageField` — a schema transformer that adds a `language` field to each type listed in `localizedSchemaTypes`

Use `withLocaleFilter` in your structure definition to scope document lists by the active locale.

## Sub-path exports

| Import                         | What it provides                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `@starter/l10n`                | `createL10n`, `injectLanguageField`, `withLocaleFilter`                                            |
| `@starter/l10n/promptAssembly` | `assembleStyleGuide`, `buildTranslateParams`, `filterGlossaryByContent`, `extractProtectedPhrases` |
| `@starter/l10n/queries`        | GROQ queries: `SUPPORTED_LANGUAGES_QUERY`, `GLOSSARIES_QUERY`, `STYLE_GUIDE_FOR_LOCALE_QUERY`      |
| `@starter/l10n/core`           | All core utilities (React-free)                                                                    |
| `@starter/l10n/core/types`     | `TranslationWorkflowStatus`, `StaleAnalysisResult`, config types                                   |

The `core/*` and `promptAssembly` exports are React-free — use them in Sanity Functions without pulling in React.

## Tests and evals

```sh
pnpm test   # Unit tests (schema, prompt assembly, locale utilities)
pnpm eval   # Model evals via Agent Actions — requires sanity login, consumes AI credits
```

See the [root README](../../README.md) for full project documentation.
