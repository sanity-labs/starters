---
name: sanity-l10n
description: 'Work with a Sanity starter that uses structured content (glossaries, style guides, locale metadata) to make AI translation enterprise-grade. Covers prompt assembly, automated stale detection via Sanity Functions, translation quality evals, and the Agent Actions Translate API. Trigger on: customize glossary, add terminology, translation style guide, run evals, deploy functions, prompt assembly, debug translation, extend l10n plugin, Agent Actions Translate, blueprint deploy, stale detection, pre-translation, field-level translation, field translation, internationalizedArray, field workflow, publish gate, field matrix, per-field translate, field approve, review workflow, translate field action. Complements sanity-best-practices (general i18n) and add-l10n-frontend (frontend rendering).'
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

4. **Automate the lifecycle** — Stale detection, change analysis, and
   pre-translation happen automatically via Sanity Functions. Editors review
   results, not initiate workflows.

5. **Lean on the platform** — Use Sanity exports, generated types (TypeGen), and
   `@sanity/*` utilities. Don't reinvent what the SDK provides.

## Orientation

Read `references/architecture.md` for the full project map. Key entry points:

- `packages/l10n/` — Unified plugin: schemas, prompt assembly, translation UI,
  hooks, evals. Sub-path exports keep serverless functions React-free.
- `functions/` — Two Sanity Functions: mark translations stale on publish,
  analyze changes + pre-translate.
- `studio/` — Studio workspace with article, person, topic, tag types.
- `apps/translations-dashboard/` — Real-time translation overview (App SDK).
- `apps/frontend/` — Next.js frontend with path-based i18n routing.
- `sanity.blueprint.ts` — Infrastructure-as-code: dataset, robot token,
  functions.
- Start here: `packages/l10n/src/promptAssembly.ts` — the core bridge between
  structured metadata and the Translate API.

### Two-Tier Architecture

The starter supports two complementary translation approaches:

- **Document-level** (`@sanity/document-internationalization`) — one document per
  locale. Used for content types where the entire document is translated (e.g.,
  articles). Configured via `localizedSchemaTypes` in `createL10n()`.
- **Field-level** (`sanity-plugin-internationalized-array`) — inline
  `internationalizedArray*` fields on a single document. Used for types where
  only specific fields need translation (e.g., person bios). Auto-detected by
  the inspector via schema walk.

Key field-level entry points:

- `packages/l10n/src/translations/FieldTranslationContent.tsx` — field x locale
  matrix inspector
- `packages/l10n/src/translations/deriveFieldCellStates.ts` — pure state
  derivation (6 rules)
- `packages/l10n/src/translations/useFieldTranslateActions.ts` — translation
  orchestration (translate, approve, dismiss)
- `packages/l10n/src/core/types.ts` — `FieldWorkflowStateEntry`,
  `FieldCellState` types

## Jobs to Be Done

### 1. Customize glossaries for my domain

Replace the Sanity product terms with your own brand terminology. The strongest
glossary entries are brand names that look like common English words — generic
terms like "Dashboard" add little value because models translate them correctly
without help.

- Read `packages/l10n/evals/fixtures.ts` to see the example glossary entries
- Read `packages/l10n/src/schemas/glossaryEntry.ts` for the 7-field anatomy
- Load `references/customization-guide.md` for detailed guidance
- Do NOT remove fields from glossary entries — each drives branching logic in
  prompt assembly

### 2. Add a content type to the l10n system

- Add the type name to `localizedSchemaTypes` in `studio/sanity.config.ts`
- Run `pnpm exec sanity schema deploy` from `studio/`
- Update the function event filter in `sanity.blueprint.ts` if the new type
  should trigger stale detection
- Redeploy functions: `pnpm exec sanity blueprints deploy`

### 3. Create or modify style guides

Style guides are per-locale: formality level, tone adjectives, and free-form
instructions in Portable Text.

- Read `packages/l10n/src/schemas/translationStyleGuide.ts` for the schema
- Read `packages/l10n/evals/fixtures.ts` for example style guides (DE, FR, JA)
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
pnpm exec sanity blueprints deploy
```

- Read `sanity.blueprint.ts` for the resource definitions
- Two functions: `mark-translations-stale` (15s timeout, triggers on publish)
  and `analyze-stale-translations` (120s timeout, 1GB memory, triggers on
  metadata update)
- Both use a shared robot token with editor role
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

### 8. Understand the field-level translation architecture

- When to use document-level vs field-level: see "Two-Tier Architecture" above
- The `fieldTranslation.metadata` schema uses `liveEdit: true` (patches write
  directly, no draft), `hidden: true`, and deterministic IDs via
  `getFieldTranslationMetadataId()`
- The 6 derivation rules in `deriveFieldCellStates.ts` merge document state with
  metadata to produce the `FieldCellState` matrix
- Inspector auto-detection: `useInternationalizedFields` walks the compiled
  schema to find all `internationalizedArray*` fields — no manual registration
- Load `references/field-level-patterns.md` for the full data flow, hook API,
  and translation pipeline details

### 9. Add field-level translations to a document type

1. Change the field type to `internationalizedArrayText` (or
   `internationalizedArrayString`) in your schema definition
2. The inspector auto-discovers it — no registration needed
3. Deploy schema: `cd studio && pnpm exec sanity schema deploy`

Example: `studio/schemaTypes/person.ts` uses `internationalizedArrayText` for
the `bio` field. The field-level inspector automatically detects it and shows
the field x locale matrix.

### 10. Customize the field-level review workflow

Load `references/field-level-patterns.md` for details on:

- Publish gate behavior — `createFieldTranslationPublishGate` wraps
  PublishAction, disables when `needsReview` or `stale` entries exist
- Concurrency limits — `MAX_CONCURRENT = 5` in `useFieldTranslateActions.ts`
- Stale detection sensitivity — `sourceSnapshot` comparison uses
  `JSON.stringify`, debounce is 500ms in `useStaleSyncEffect`
- Load `references/customization-guide.md` for modification guidance

### 11. Debug field-level translation issues

Load `references/troubleshooting.md` for common issues:

- Metadata not created — needs write permission (`liveEdit: true`)
- Publish blocked but translations look fine — stale metadata
- Fields not appearing in matrix — must use `internationalizedArray*` type
- Stale not detected — client-side only, runs when inspector is open
- Translations missing from matrix — check source content exists

## Anti-Patterns

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
  Pass `token` explicitly. See `packages/l10n/evals/authToken.ts`.
- **Do NOT skip `sanity schema deploy`** — Agent Actions requires deployed
  schema. Schema ID is `_.schemas.default`.
- **Do NOT manually create `fieldTranslation.metadata` documents** —
  deterministic IDs via `getFieldTranslationMetadataId()`. The hooks and actions
  create them automatically with `createIfNotExists`.
- **Do NOT use `useFormValue` for field translation data** — the inspector
  renders outside form context. Use `documentStore.listenQuery()` instead (see
  `useFieldTranslationData.ts`).
- **Do NOT skip the publish gate** — `createFieldTranslationPublishGate` wraps
  PublishAction. Don't remove it or bypass it without understanding the
  consequences for translation review workflows.

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
