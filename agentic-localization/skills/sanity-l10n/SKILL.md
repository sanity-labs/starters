---
name: sanity-l10n
description: 'Work with a Sanity starter that uses structured content (glossaries, style guides, locale metadata) to make AI translation enterprise-grade. Covers prompt assembly, localization runs on Sanity Editorial Workflows, translation quality evals, and the Agent Actions Translate API. Trigger on: customize glossary, add terminology, translation style guide, run evals, deploy functions, prompt assembly, debug translation, extend l10n plugin, Agent Actions Translate, blueprint deploy, localization run, workflow definition, effect handler, field-level translation, field translation, internationalizedArray, review workflow. Complements sanity-best-practices (general i18n) and add-l10n-frontend (frontend rendering).'
---

# Sanity Agentic Localization

## Core Principles

Enterprise translation quality comes from structured metadata, not better
engines. This starter closes the gap between enterprise TMS capabilities and AI
translation APIs. See `docs/I18N_RESEARCH.md` for the full gap analysis.

1. **Structured content is the medium** — Glossaries, style guides, and locale
   rules are Sanity documents. Content teams maintain them in the Studio. Code
   queries them at translation time. Every job reuses them.

2. **Content-aware assembly** — Don't dump all glossary terms into every prompt.
   `filterGlossaryByContent()` prunes to terms that actually appear in the
   source document. Always include do-not-translate and forbidden terms as
   guardrails.

3. **Prove it** — Translate WITH and WITHOUT context. Measure the delta. If
   glossaries don't measurably improve quality, the terms need work. The
   strongest entries are brand names that look like common English words (e.g.,
   "Releases", "Perspectives", "Portable Text").

4. **Automate the lifecycle** — Publishing a source document starts a
   localization run on Editorial Workflows. Editors review results, not initiate
   workflows.

5. **Lean on the platform** — Use Sanity exports, generated types (TypeGen), and
   `@sanity/*` utilities. Don't reinvent what the SDK provides.

## Orientation

Read `references/architecture.md` for the full project map. Key entry points:

- `packages/l10n/` — Unified plugin: schemas, prompt assembly, translation UI,
  hooks, evals. Sub-path exports keep serverless functions React-free.
- `packages/l10n/src/workflows/` — Editorial Workflows definitions
  (`localize-campaign` → `localize-document` → `localize-locale`) plus their
  in-memory bench specs. React-free; composable into Functions and the CLI.
- `packages/l10n/src/effects/` — the effect handlers those definitions declare.
- `functions/` — the engine's runtime. Migration state is in
  `docs/WORKFLOW_ENGINE_MIGRATION.md`.
- `studio/` — Studio workspace with article, person, topic, tag types.
- `apps/translations-dashboard/` — Real-time translation overview (App SDK).
- `apps/frontend/` — Next.js frontend with path-based i18n routing.
- `sanity.blueprint.ts` — Infrastructure-as-code: datasets, robot token,
  Functions. `sanity.workflow.ts` deploys the definitions.
- Start here: `packages/l10n/src/promptAssembly.ts` — the core bridge between
  structured metadata and the Translate API.

### Two-Tier Architecture

The starter supports two complementary translation approaches:

- **Document-level** (`@sanity/document-internationalization`) — one document per
  locale. Used for content types where the entire document is translated (e.g.,
  articles). Configured via `localizedSchemaTypes` in `createL10n()`.
- **Field-level** (`sanity-plugin-internationalized-array`) — inline
  `internationalizedArray*` fields on a single document. Used for types where
  only specific fields need translation (e.g., person bios). Declared in the
  registry in `packages/l10n/src/core/fieldTier.ts`.

Both tiers run the same workflow definitions; the field tier diverges only in
where a locale's translation is written. See
`references/field-level-patterns.md`.

## Jobs to Be Done

### 1. Customize glossaries for my domain

Replace the Sanity product terms with your own brand terminology. The strongest
glossary entries are brand names that look like common English words — generic
terms like "Dashboard" add little value because models translate them correctly
without help.

- Read `packages/l10n/src/prompts/evals/fixtures.ts` to see the example glossary entries
- Read `packages/l10n/src/schemas/glossaryEntry.ts` for the 7-field anatomy
- Load `references/customization-guide.md` for detailed guidance
- Do NOT remove fields from glossary entries — each drives branching logic in
  prompt assembly

### 2. Add a content type to the l10n system

- Add the type name to `localizedSchemaTypes` in `studio/sanity.config.ts`
- Run `pnpm exec sanity schema deploy` from `studio/`
- Add the type to the `start-localization` event filter in `sanity.blueprint.ts`
  and to `localize-document`'s subject types in
  `packages/l10n/src/workflows/localizeDocument.ts`
- Redeploy: `pnpm exec sanity blueprints deploy` and `pnpm workflows:deploy`

### 3. Create or modify style guides

Style guides are per-locale: formality level, tone adjectives, and free-form
instructions in Portable Text.

- Read `packages/l10n/src/schemas/translationStyleGuide.ts` for the schema
- Read `packages/l10n/src/prompts/evals/fixtures.ts` for example style guides (DE, FR, JA)
- Load `references/customization-guide.md` for best practices
- Style guides are fetched by locale code via `STYLE_GUIDE_FOR_LOCALE_QUERY`

### 4. Run and understand evals

Two test suites live in `packages/l10n/`:

```sh
pnpm --filter l10n test   # Unit tests: schema, prompt assembly, locale utils
pnpm --filter l10n eval   # Model evals: translate with/without context, score delta
```

- Evals require `sanity login` and consume AI credits
- Two-layer scoring: deterministic checks (term presence/absence/patterns) +
  LLM judge (4 dimensions, 3 trials averaged)
- Pass = deterministic.pass AND judge.overall >= 3.5
- Load `references/customization-guide.md` for writing new eval cases

### 5. Deploy functions and infrastructure

```sh
pnpm exec sanity blueprints deploy   # datasets, robot token, Functions
pnpm workflows:deploy                # workflow definitions
```

- Read `sanity.blueprint.ts` for the resource definitions and
  `sanity.workflow.ts` for the definition deployment; both name the same engine
  coordinates, imported from `packages/l10n/src/workflows/config.ts`
- All Functions share one robot token with the editor role
- Load `references/customization-guide.md` for modifying function filters and
  env vars

### 6. Understand prompt assembly

The pipeline in `packages/l10n/src/promptAssembly.ts`:

1. `extractDocumentText()` — recursively extract text from a Sanity document
2. `filterGlossaryByContent()` — prune glossary to terms in the source
3. `buildGlossarySection()` — format entries as Approved / DNT / Forbidden
4. `buildStyleGuideSection()` — format formality, tone, instructions
5. `assembleStyleGuide()` — combine glossary + style guide into a single string
6. `extractProtectedPhrases()` — pull DNT terms for the API's protectedPhrases
7. `buildTranslateParams()` — package everything for Agent Actions Translate

Read the source file directly — it's ~250 lines and well-commented.

### 7. Debug a translation issue

Load `references/troubleshooting.md` for common issues:

- Agent Actions errors (schema not deployed, token missing)
- Style guide too large (>12,000 chars warning)
- Eval failures (sourceText/fieldPath mismatch, auth token resolution)
- Functions issues (pnpm dep resolution, env var loading in jiti)

### 8. Understand the field-level tier

Load `references/field-level-patterns.md`. Canonical sources:
`packages/l10n/src/core/fieldTier.ts` (registry, coverage, source projection,
start perspective), `packages/l10n/src/effects/translateLocale.ts` (the
in-place write branch) and `packages/l10n/src/translations/FieldTierContent.tsx`
(the inspector surface).

### 9. Add field-level translations to a document type

1. Use `internationalizedArrayText` (or `internationalizedArrayString`) for the
   field in your schema definition
2. Register the type and its field paths in `FIELD_TIER` in
   `packages/l10n/src/core/fieldTier.ts` — handlers run in Functions with no
   compiled schema to walk, so the registry is static
3. Add the type to `localize-document`'s subject types and to the function
   filters in `sanity.blueprint.ts`, as in job 2
4. Redeploy: `cd studio && pnpm exec sanity schema deploy`, then
   `pnpm exec sanity blueprints deploy` and `pnpm workflows:deploy`

Example: `studio/schemaTypes/person.ts` uses `internationalizedArrayText` for
`bio`, registered alongside `seo.metaTitle` and `seo.metaDescription`.

## Anti-Patterns

- **Do NOT hand-roll orchestration** — no semaphores, no status enums, no
  "is this stale yet" caches, no `for` loops over locales. Fan-out, retries,
  concurrency, review gates and idempotency are Editorial Workflows primitives.
  ~4,600 lines of exactly this are on the delete list; don't add more.
- **Do NOT put workflow state on content documents** — the instance owns run
  state, content documents own content state. There is no per-field status
  ledger to write to; coverage is derived from the arrays themselves.
- **Do NOT edit workflow instances as content** — no `useEditDocument`, no raw
  patches. Every instance write goes through an engine verb (`fireAction`,
  `editField`, `tick`, `completeEffect`) or it bypasses gates, history and the
  transaction boundary.
- **Do NOT let UI imports into `src/workflows/` or `src/core/`** — both are
  React-free so Functions, the CLI and evals can import them at no bundle cost.
  Check with `grep -rn "react\|@sanity/ui"` before adding an import.
- **Do NOT deploy a definition you haven't proven on the bench** —
  `@sanity/workflow-engine-test` runs the real engine in memory with no project or
  network. It catches spawn-identity, cohort-gating and recovery bugs that only
  otherwise surface against a live dataset.
- **Do NOT mix `@sanity/workflow-*` versions** — they are exact-version peers of
  one another and ship breaking changes in minor releases. Pin exactly; upgrade as
  a set.
- **Do NOT duplicate l10n schema types** — the plugin registers them via
  `createL10n()`. Adding them to `studio/schemaTypes/` causes conflicts.
- **Do NOT hardcode locale lists** — query `l10n.locale` documents. The seed
  migration creates them.
- **Do NOT inject all glossary terms** — use `filterGlossaryByContent()` to
  keep prompts focused.
- **Do NOT remove glossary entry fields** — all 7 (term, status,
  doNotTranslate, partOfSpeech, definition, context, translations) drive
  branching logic in `buildGlossarySection()`.
- **Do NOT use `getCliClient` outside CLI** — it won't resolve auth tokens.
  Pass `token` explicitly. See `packages/l10n/src/prompts/evals/authToken.ts`.
- **Do NOT skip `sanity schema deploy`** — Agent Actions requires deployed
  schema. Schema ID is `_.schemas.default`.
- **Do NOT use `useFormValue` in the inspector** — it renders outside form
  context. Read the document through `useEditState` (see
  `translations/FieldTierContent.tsx`).
- **Do NOT bypass a run's action guards** — `localize-document` guards its
  subject against `publish` while translating and in review, and
  `createLocalizationScheduleGate` closes the one action the Studio plugin's
  lock map misses. Don't unwrap either.

## Reference Files

| File                                 | Load when...                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `references/architecture.md`         | You need the full project map, data flow, or schema overview      |
| `references/customization-guide.md`  | Customizing glossaries, style guides, evals, or functions         |
| `references/troubleshooting.md`      | Debugging translation, eval, or deployment issues                 |
| `references/field-level-patterns.md` | Understanding or customizing the field-level translation workflow |

## Companion Skills

- **sanity-best-practices** — General i18n patterns: document-level vs
  field-level, `@sanity/document-internationalization`
- **add-l10n-frontend** — Frontend rendering of localized content (Next.js
  reference implementation, patterns for other frameworks)
