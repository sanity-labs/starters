# Changelog

All notable changes to this starter template are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Localization runs on [Editorial Workflows](https://www.sanity.io/docs/editorial-workflows/concepts)** — three definitions (`localize-campaign` → `localize-document` → `localize-locale`) own analysis, fan-out, retries, guards and the review gate. Run state lives on the workflow instance; content documents carry content only. Definitions are proven against the real engine in memory (`@sanity/workflow-engine-test`) before they deploy
- **Four Sanity Functions as the engine's runtime** — `start-localization`, `drain-effects`, `handle-deleted-subject`, `distill-review` — plus an opt-in scheduled `heartbeat`. The definitions hold at most one pending effect per instance, so one drain is at most one AI call ([docs/functions.md](docs/functions.md))
- **A dedicated `workflows` dataset** for engine storage, declared in the blueprint, plus `sanity.workflow.ts` and `pnpm workflows:deploy` for the definition deploy
- **The distillation loop** — what a reviewer corrects becomes draft `l10n.proposal` documents (glossary entries, style-guide rules, eval-case coordinates) that a human accepts. Prompt assembly reads only published, approved context, so two human acts stand between automation and a prompt ([adr-002](docs/decisions/adr-002-learning-loop.md))
- **Both localization tiers on the same three definitions** — only the effect handler's write target differs
- **End-to-end journeys** (`e2e/`) — Gherkin scenarios against a real project: real datasets, deployed definitions, real Content Lake guards. Nightly, not per-commit
- **Agent skills** (`skills/`) for the pattern, its adoption, extension and operation, with deterministic drift checks and live routing evals
- **Decision records** (`docs/decisions/`) for the package shape and the learning loop

### Changed

- **Breaking:** `@starter/l10n` split in two — `@starter/l10n` is the node floor (primitives, prompt assembly, workflow definitions, effect handlers) and is React-free by construction, enforced by a lint zone and a resolved-module-graph test; `@starter/l10n-studio` holds the plugin, schema types and the Translations inspector ([adr-001](docs/decisions/adr-001-package-shape.md))
- **Breaking:** Sanity Studio v6 — the workflow Studio plugin needs 6.3+ and there is no v5 path — and Node >= 22.18
- Review is one human pass over the whole document, across all locales; locale children are machine-only
- `publish` is held by the run's own engine guard rather than a hand-rolled gate; `schedule` is wrapped at the config root, because core injects it after plugins resolve
- Schema types moved to `@sanity/types` imports (`defineType`/`defineField`), keeping a schema registration from pulling the whole Studio into a consumer's bundle
- Linting is oxlint extending `@sanity/plugin-kit/oxlint`, the org's shared preset — `oxlint.config.ts` replaces the eslint stack and the `@starter/eslint-config` package

### Removed

- **~4,600 lines of hand-rolled orchestration** — the duplicated translate pipelines, `createSemaphore` and four divergent concurrency limits, four disjoint status vocabularies, the React status reducers, and the cache-based staleness guard. All of it is an engine primitive now
- `mark-translations-stale` and `analyze-stale-translations` Functions, superseded by `start-localization` and the `analyze-source` effect
- Workflow fields on `translation.metadata`, and `fieldTranslation.metadata` entirely. `translation.metadata` itself stays: it is the document-internationalization plugin's join document and genuine content state
- The field × locale matrix and its per-cell verbs — both tiers render the same run
- The AI Assist translate field action, the last path that translated without assembled context and without review

## [2.0.0] - 2026-04-10

### Added

- **Field-level translation workflow** with human-in-the-loop review, stale detection via source snapshots, `StaleDiffPopover` for before/after diff, and publish/schedule action gating that prevents shipping unresolved translations ([#21](https://github.com/sanity-labs/starters/pull/21))
- **Batch field translation** via `fieldLanguageMap`, reducing AI credits from N to 1 per locale, with per-locale translate buttons on column headers ([#25](https://github.com/sanity-labs/starters/pull/25))
- **AI Assist translate field action** wired to `@sanity/assist` for internationalized array fields, with migration for existing documents
- **Field-level i18n for person bio** using `internationalizedArray` plugin
- **Shared context providers** (`LocalesProvider`, `GlossariesProvider`) consolidated into a single `L10nProvider`, eliminating duplicate EventSource connections ([#27](https://github.com/sanity-labs/starters/pull/27))
- `@sanity/assist` dependency for Agent Actions presence indicators
- Nested object path handling (e.g., `seo.metaTitle`) and conditional hidden field support for field-level i18n ([#25](https://github.com/sanity-labs/starters/pull/25))
- Animated state transitions in the field translation matrix ([#25](https://github.com/sanity-labs/starters/pull/25))
- Architecture documentation for field-level i18n, editorial workflow, and slug uniqueness ([#22](https://github.com/sanity-labs/starters/pull/22), [#23](https://github.com/sanity-labs/starters/pull/23))
- Unit tests for `fieldMetadataIds`, `deriveFieldCellStates`, metadata lifecycle, and RBAC gating

### Changed

- **Breaking:** Upgraded `@sanity/document-internationalization` v5 to v6 — array items now use a `language` field instead of `_key` for language identification. Also upgraded `sanity-plugin-internationalized-array` v4 to v5. ([#20](https://github.com/sanity-labs/starters/pull/20))
- Slug uniqueness checks scoped to the same language via `isUniqueOtherThanLanguage` helper ([#18](https://github.com/sanity-labs/starters/pull/18))
- Moved sanity-provided dependencies to `peerDependencies` in `@starter/l10n`
- Replaced full `sanity` studio import with inline type guards in serverless functions, reducing bundle from 9.6 MB to 466 KB
- Restructured function builds as directories for blueprint deploy compatibility
- Deterministic metadata IDs via `getTranslationMetadataId()`
- Strong references with `_strengthenOnPublish` for translation metadata

### Fixed

- Restored missing function directories after restructure ([#12](https://github.com/sanity-labs/starters/pull/12))
- Token format in environment configuration ([#15](https://github.com/sanity-labs/starters/pull/15))
- Translation pane data refresh on document changes
- `AbortController` illegal invocation in `LocaleNavbar`
- Double-append bug in translation inspector metadata writes
- Bootstrap and deploy pipeline — unified ESM bootstrap script with env resolution
- Blueprint deploy idempotency (wrapped init in try/catch with fallback)
- Environment cascade matching Vite precedence order (`.env.local` > `.env`)
- Google Fonts `@import` ordering before Tailwind CSS rules
- `tsx` ESM loader for `sanity exec` on Node 20
- GitHub link in Studio UI ([#13](https://github.com/sanity-labs/starters/pull/13))

### Removed

- Legacy `LegacyDocumentStatus` and `TranslationDataStatus` types
- Deprecated `isPublished` field from translation metadata
- Local `randomKey` utility (replaced by `@sanity/util/content`)

## [1.0.0] - 2026-03-02

Initial release — Studio with document-level i18n, glossaries, style guides, locale rules, prompt assembly, serverless stale detection, translation pane and inspector, translations dashboard (App SDK), Next.js frontend with path-based i18n routing, and quality evals.
