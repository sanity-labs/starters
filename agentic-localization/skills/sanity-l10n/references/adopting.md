# Adopting the pattern

Two paths. **Greenfield** — no localization anywhere yet, and you can lay the
elements down in the order the pattern wants. **Brownfield** — an existing Studio
and dataset with content, editors and probably some localization already; the
work is fitting the pattern around what is there.

Both paths install the same elements. The difference is the order and what has to
be migrated.

If the project is a fresh clone of this starter, the setup is already done:
[`README.md`](../../../README.md) has the commands (`pnpm bootstrap` and what it
does step by step). Read that instead of this file.

## The element map

Every workspace package here is private and unpublished, so taking an element is
a directory copy plus a manifest entry — not a package install (see
[adr-001](../../../docs/decisions/adr-001-package-shape.md)).

| Element                | Where it is                                                | Needed for                                                         |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Node floor             | `packages/l10n/`                                           | Everything. Primitives, assembly, definitions, handlers            |
| Studio layer           | `packages/l10n-studio/`                                    | Schema types, the plugin, the review pane                          |
| Studio composition     | `studio/sanity.config.ts`                                  | The worked example: `createL10n()` beside `workflowStudioPlugin()` |
| Workflow deploy config | `sanity.workflow.ts`                                       | Getting definitions into the engine                                |
| Infrastructure         | `sanity.blueprint.ts`                                      | Both datasets, robot token, Function resources                     |
| Engine runtime         | `functions/`                                               | The engine has no daemon; these are it                             |
| Locale seed            | `studio/migrations/seed-locales.ts`                        | Turning locale codes into `l10n.locale` documents                  |
| Distillation loop      | `packages/l10n/src/distill/` + `functions/distill-review/` | Optional. Deletable as one directory plus one blueprint resource   |
| Coverage dashboard     | `apps/translations-dashboard/`                             | Optional. Cross-locale gap view (App SDK)                          |
| Localized frontend     | `apps/frontend/`                                           | Optional, and standalone — see the add-l10n-frontend skill         |
| Journey tests          | `e2e/`                                                     | Optional, but the only coverage of the deployed stack              |

Minimum viable adoption is the first seven rows. The last four are additive and
each removable without touching the others.

## Requirements

Non-negotiable, and worth checking before promising a timeline:

- **Node >= 22.18, Sanity Studio v6.** The workflow Studio plugin needs 6.3+.
  There is no v5 path.
- **A dataset for the engine.** Instances do not live with content. The blueprint
  creates it; `WORKFLOWS_DATASET` and `WORKFLOW_TAG` in
  `packages/l10n/src/workflows/config.ts` name it, and every reader — deploy,
  Functions, Studio, dashboard — must name the same pair. A mismatch is silent:
  the reader sees an empty partition.
- **A robot token with the editor role**, provisioned as a blueprint resource.
  Functions write content and workflow instances.
- **A deployed schema.** Agent Actions resolves its target against the deployed
  schema, not the local one.
- **A source language, set before the first deploy.** `SOURCE_LANGUAGE` in
  `packages/l10n/src/workflows/config.ts` is the coordinate every run reads
  from — the Studio's `defaultLanguage`, the dashboard, the publish Function's
  blueprint filter and `LOCALE_CODES[0]` all take it from there. A constant
  rather than runtime config because deployed definitions are static artifacts:
  change it and redeploy the definitions and the blueprint.
- **Exactly pinned `@sanity/workflow-*`.** Every one is an exact-version peer of
  the others and breaking changes ship in minors. Pin in one place — here, the
  `pnpm-workspace.yaml` catalog.

## Greenfield

1. **Decide the locale set and the source language.** `SOURCE_LANGUAGE` in
   `packages/l10n/src/workflows/config.ts` is the source; the targets are
   `LOCALE_CODES` in `studio/migrations/seed-locales.ts`, whose first entry is
   that constant. Everything else derives from the BCP-47 code via `Intl`.
2. **Decide the tier per content type.** One document per locale (document tier)
   or language-keyed fields on one document (field tier). See the tier table in
   `references/pattern.md`. This choice is hard to reverse — it is a storage
   shape, not a setting.
3. **Register the types.** Document tier: `localizedSchemaTypes` in
   `createL10n()`. Field tier: `FIELD_TIER` in
   `packages/l10n/src/core/fieldTier.ts`, including ancestor `containers`,
   because a Sanity patch does not create missing parent objects.
4. **Compose the Studio.** `createL10n()` returns `{plugin, injectLanguageField}`;
   both are used (see `packages/l10n-studio/README.md`). Add
   `workflowStudioPlugin()` with the same tag and dataset, and wrap the
   `schedule` action with `createLocalizationScheduleGate` — it sits outside the
   workflow plugin's lock map.
5. **Deploy infrastructure, then schema.** `sanity blueprints deploy` then
   `sanity schema deploy`. Functions must be built first
   (`pnpm --filter @starter/functions build`) — the blueprint points at
   `functions/dist/<name>`, see [docs/functions.md](../../../docs/functions.md).
6. **Deploy the definitions.** `pnpm workflows:deploy` (`sanity-workflows deploy`
   reading `sanity.workflow.ts`). All definitions go as one set: a parent cannot
   spawn a child that is not deployed.
7. **Seed locales**, then author context: one glossary, and a style guide for each
   locale that needs a specific register.
8. **Verify end to end.** Publish a source document. A `localize-document`
   instance should appear in the workflows dataset, fan out one child per target
   locale, and land in `review`.

## Brownfield

Everything in the greenfield list still applies. These are the additional
questions an existing project raises.

**Who reviews, and is that person named?** Ask this first, before any of the
technical questions. The pattern puts a human at the gate, so an adoption without
a named reviewer and a place that queue lives produces runs that park in `review`
and translations that never publish. It is the most common way an adoption stalls
and the only one no amount of correct code fixes. Raise it as a risk in the plan,
not as a footnote after the migration steps.

**Is there already localized content?** Two failure modes. If documents were
localized by hand with a home-grown pattern, the join documents and language
fields have to be produced before a run can find a target;
`studio/migrations/migrateToLanguageField.ts` shows the shape (it delegates to
`sanity-plugin-internationalized-array/migrations`). If documents were localized
with `@sanity/document-internationalization` already, they are compatible — check
that `translation.metadata` documents exist and that the language field name
matches `languageFieldName`.

**Is there existing orchestration?** A cron job, a webhook, a "translate now"
button, a status field on the document. All of it comes out. Keeping both means
two systems fighting over the same target documents, and the engine's guards
cannot see writes made outside them. Publishing is the trigger; the instance is
the status.

**Are the types the pattern can subject?** A run needs a stable source-language
projection to diff. Types whose source text is assembled at render time, or
spread across referenced documents, need the reference graph included in the
projection before analysis is meaningful.

**What does the publish filter have to match?** The `start-localization` event
filter in `sanity.blueprint.ts` and the `subject` types on
`packages/l10n/src/workflows/localizeDocument.ts` must agree. Both are literal
lists. Adding a type means editing both and redeploying both — the blueprint and
the definitions.

## Authoring the context

The context is the product. Two rules that come from measuring, not taste:

**Glossary entries earn their place by producing a quality delta.** The strongest
entries are brand names that look like ordinary words in the source language —
they are exactly what a model translates confidently and wrongly. Generic
technical vocabulary adds nothing: a model already handles it. Do-not-translate
entries for product names are the highest-value entry in the set, because they
also become the API's `protectedPhrases`.

**Prove it, do not assume it.** `packages/l10n/src/prompts/evals/` translates
each case with and without context and scores the delta. If a glossary produces
no delta, the entries are wrong, not the method. `packages/l10n/src/prompts/evals/fixtures.ts`
is the worked example set.

Style guides are per locale: formality register, a few tone adjectives, and
free-form instructions for what neither expresses ("address the reader with
_vous_", "prefer shorter sentences"). One per locale that needs specific
treatment — not one per locale by reflex.

## Adding a type later

The four places a type name appears, and all four must agree:

1. `localizedSchemaTypes` in `createL10n()` — or `FIELD_TIER` for the field tier.
2. The `subject` field's types in `packages/l10n/src/workflows/localizeDocument.ts`.
3. The `start-localization` and `handle-deleted-subject` event filters in
   `sanity.blueprint.ts`.
4. `sanity schema deploy`, so Agent Actions can resolve it.

Then redeploy both the blueprint and the definitions. A missing entry fails
quietly in a different way at each layer, which is why they are worth checking as
a set.
