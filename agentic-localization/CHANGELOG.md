# Changelog

All notable changes to this starter template are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
