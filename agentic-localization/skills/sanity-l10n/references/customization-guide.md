# Customization Guide

## Glossary Customization

### The 7-Field Anatomy

Every glossary entry has 7 fields. Each one drives branching logic in
`buildGlossarySection()` — don't remove any.

Read `packages/l10n/src/schemas/glossaryEntry.ts` for the schema definition and
`packages/l10n/src/promptAssembly.ts` for how each field is consumed.

| Field            | Type                                                    | Effect on prompt                                                               |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `term`           | string (required)                                       | The source-language term being defined                                         |
| `status`         | enum: approved / forbidden / provisional / non-standard | Controls which subsection the entry lands in (Approved Terms, Forbidden Terms) |
| `doNotTranslate` | boolean                                                 | Moves entry to "Do Not Translate" subsection; hides the translations array     |
| `partOfSpeech`   | enum: noun / verb / adjective / ...                     | Appended as metadata: "Studio (noun)"                                          |
| `definition`     | text                                                    | Adds a definition line: "Definition: ..."                                      |
| `context`        | string                                                  | Adds a usage context line: "Context: ..."                                      |
| `translations`   | array of `l10n.locale.translation`                      | Per-locale approved translations with optional gender                          |

### Designing for Quality Deltas

The strongest glossary entries are brand names that look like common English
words. These create measurable quality differences because models translate them
as generic terms without explicit guidance.

**Strong entries** (high delta):

- "Releases" — looks like a generic English noun, but it's a Sanity product name
- "Perspectives" — same pattern
- "Portable Text" — looks like a description, but it's a proper noun (DNT)
- "Content Lake" — compound term that gets split and translated without guidance

**Weak entries** (low delta):

- "Dashboard" — generic tech term, models handle it correctly without help
- "Workspace" — same
- "API" — universally understood acronym

Read `packages/l10n/src/prompts/evals/fixtures.ts` for the example entries and
`packages/l10n/src/prompts/evals/` for how deltas are measured.

### Adapting to Your Domain

1. **Audit your terminology** — List brand names, product features, and internal
   terms that look like common English. These are your high-value entries.
2. **Add DNT entries** for terms that must stay in the source language across all
   locales (product names, feature names).
3. **Add forbidden entries** for terms you never want in output (e.g., "CMS",
   "headless CMS" if you prefer "content platform").
4. **Add approved translations** for terms that have specific translations per
   locale (e.g., a feature name that has an official German equivalent).
5. **Test with evals** — translate with and without your glossary, measure the
   delta. If the delta is near zero, the entries aren't adding value.

### `shouldNotContain` Gotcha

When writing eval expectations, don't block common target-language words that
appear naturally in translation. For example, "Veröffentlichungen" (German for
"publications") appears naturally when translating "Coordinate launches" — even
though the product name "Releases" was correctly preserved elsewhere in the same
text. Only block terms that would ONLY appear as a mistranslation.

## Style Guide Customization

Style guides are per-locale documents with three components. Read
`packages/l10n/src/schemas/translationStyleGuide.ts` for the schema.

### Formality

Enum: `formal`, `informal`, `casual`. Maps to a line in the assembled prompt:
"Formality: Use {level} register."

### Tone

Array of 1–5 adjectives (e.g., "professional", "approachable", "concise").
Formatted as: "Tone: professional, approachable, concise."

### Additional Instructions

Free-form Portable Text (bold/italic/code decorators only). This is where you
put locale-specific rules that don't fit formality or tone:

- "Use Markdown-style backticks for UI element names"
- "Address the reader with 'vous' (formal you)"
- "Prefer shorter sentences for Japanese readability"

### Per-Locale Targeting

Style guides are linked to a specific `l10n.locale` document via the `locale`
reference field. The query `STYLE_GUIDE_FOR_LOCALE_QUERY` fetches the guide
matching the target locale code. Create one style guide per locale that needs
specific treatment.

Read `packages/l10n/src/prompts/evals/fixtures.ts` for example style guides (DE formal +
precise, FR formal + elegant, JA formal + concise).

## Adding Localized Content Types

### Step by Step

1. **Define the schema type** in `studio/schemaTypes/` — standard Sanity
   document type. Don't add a `language` field manually; the plugin injects it.

2. **Register it** — add the type name to `localizedSchemaTypes` in
   `studio/sanity.config.ts`:

   ```ts
   const l10n = createL10n({localizedSchemaTypes: ['article', 'tag', 'yourNewType']})
   ```

3. **Deploy schema** — required for Agent Actions:

   ```sh
   cd studio && pnpm exec sanity schema deploy
   ```

4. **Update the trigger** — for publishing the type to start a localization run,
   widen the `start-localization` event filter in `sanity.blueprint.ts`:

   ```ts
   filter: "_type in ['article', 'yourNewType'] && language == 'en-US'"
   ```

   and add the type to the `subject` field's `types` in
   `packages/l10n/src/workflows/localizeDocument.ts`.

5. **Redeploy**:
   ```sh
   pnpm exec sanity blueprints deploy
   pnpm workflows:deploy
   ```

### What `localizedSchemaTypes` Does

Only types listed here get:

- The injected `language` field (via `injectLanguageField`)
- Translation metadata tracking
- The Translation Pane and Inspector UI
- Locale-scoped document lists (via `withLocaleFilter`)

## Functions and Blueprint Customization

### The Runtime Functions

`functions/` holds the engine's runtime — `drain-effects`,
`start-localization`, `handle-deleted-subject` and an opt-in `heartbeat`. Their
triggers, timeouts and env are declared as resources in `sanity.blueprint.ts`;
what they execute lives in `packages/l10n/src/effects/`.

Engine coordinates (the `workflows` dataset and the `production` tag) come from
`packages/l10n/src/workflows/config.ts`. Change them there and the blueprint,
the definition deploy, the Studio and the dashboard all follow.

### Environment Variables

Functions access env vars defined in the blueprint's `env` property. The
blueprint loads from the root `.env.local` file. Key vars:

- `SANITY_STUDIO_PROJECT_ID` — project ID (required)
- `SANITY_STUDIO_DATASET` / `BLUEPRINT_DATASET` — dataset name
- Robot token is provisioned as a blueprint resource and injected automatically

### Blueprint Env Loading Gotcha

The blueprint file is loaded by jiti (not Node.js directly).
`process.loadEnvFile()` silently succeeds but doesn't set vars in jiti context.
The blueprint uses `readFileSync` + manual parsing instead. See the top of
`sanity.blueprint.ts`.

## Field-Level Workflow Customization

### Adding Field-Level Types

The `internationalizedArray` plugin is configured inside `createL10n()` in
`packages/l10n/src/plugin.ts`:

```ts
internationalizedArray({
  languages: (client) =>
    client.fetch<Language[]>(SUPPORTED_LANGUAGES_QUERY, {}, {tag: 'plugin.languages'}),
  defaultLanguages: [defaultLanguage],
  fieldTypes: ['string', 'text'],
})
```

Register the type and its field paths in `FIELD_TIER` in
`packages/l10n/src/core/fieldTier.ts` — including any ancestor `containers`, so
patches create missing parent objects — then add it to `localize-document`'s
subject types and the blueprint's function filters.

### Request Tags

The starter sets `requestTagPrefix: 'kit.agentic-l10n'` on every
`createClient({...})` and adds per-call `tag: '<area>.<action>'` options
(e.g. `tag: 'translate.style-guide'`), producing combined tags like
`kit.agentic-l10n.translate.style-guide` — handy for filtering your own
request logs. Keep this scheme when extending, or change `requestTagPrefix` in
your client config to use whatever tagging scheme you prefer. See
[Request tags](https://www.sanity.io/docs/apis-and-sdks/js-client-request-tags).

To support additional value types (e.g., `blockContent`), add them to the
`fieldTypes` array. Then use `internationalizedArrayBlockContent` as the field
type in your schema.

### Gating, Concurrency and Change Detection

All three are engine concerns now, not knobs in the UI layer:

- **Gating** — `localize-document` guards its subject against `publish`;
  `packages/l10n/src/translations/scheduleGate.ts` closes `schedule`
- **Concurrency** — the `fan-out` action's `spawn` in
  `packages/l10n/src/workflows/localizeDocument.ts`, one child per locale
- **Change detection** — `analyzeSource` diffs the source-locale projection
  (`sourceProjection` in `core/fieldTier.ts`) across revisions

## Eval Framework

### Two Test Suites

The l10n package has two vitest configs:

- `vitest.config.ts` — unit tests (`*.test.ts`): schema validation, prompt
  assembly, locale utilities. Fast, no network.
- `vitest.eval.config.ts` — model evals (`*.eval.ts`): translate via Agent
  Actions API, score results. Slow, requires auth, consumes AI credits.

### Writing a New Eval Case

An `EvalCase` defines a translation scenario. Read
`packages/l10n/src/prompts/evals/types.ts` for the type and existing eval files for
examples.

```ts
const myCase: EvalCase = {
  id: 'my-case',
  description: 'What this tests',
  sourceText: 'The English text to translate',
  sourceLocale: enUS,
  targetLocale: deDE,
  glossaries: [techGlossary], // from fixtures.ts
  styleGuide: deDEStyleGuide, // from fixtures.ts
  expectations: {
    shouldContain: ['expected term'], // must appear in output
    shouldNotContain: ['bad term'], // must NOT appear
    shouldMatchPattern: [/regex/i], // pattern match
    description: 'Criteria for the LLM judge',
  },
  baselineRisks: ['What goes wrong without context'],
}
```

### Two-Layer Scoring

1. **Deterministic** (`scoring.ts`): `checkTermPresence`, `checkTermAbsence`,
   `checkPatterns` — binary pass/fail per check.
2. **LLM judge** (`judge.ts`): 4 quality dimensions with weights, averaged over
   3 trials to reduce variance.

Combined pass criteria: `deterministic.pass AND judge.overall >= 3.5`.

### Fixture Design Lessons

- **sourceText must match fieldPath** — the judge compares sourceText against
  the translated field. Mismatch causes low scores even when translation is
  correct.
- **Japanese DNT delta is near zero** — the Translate API already preserves
  English product names in Latin script for JA. French and German glossary evals
  show stronger deltas (+1.2 to +1.55).
- **Generic tech terms don't differentiate** — "Dashboard" and "Workspace"
  translate correctly without glossaries. Use Sanity-specific product names that
  LOOK like generic English.
