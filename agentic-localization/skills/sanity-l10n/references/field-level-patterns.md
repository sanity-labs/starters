# Field-level translation (person)

The field tier runs on the same three workflow definitions as the document
tier. The one divergence: a person's translations live in its own
`internationalizedArray` fields (`bio`, `seo.metaTitle`,
`seo.metaDescription`), so the `translate-locale` handler patches
language-keyed entries in place instead of writing sibling documents.

| Aspect       | Document-level                                | Field-level                                     |
| ------------ | --------------------------------------------- | ----------------------------------------------- |
| Plugin       | `@sanity/document-internationalization`       | `sanity-plugin-internationalized-array`         |
| Storage      | Separate document per locale                  | Inline array entries on the same document       |
| Run state    | The `localize-document` workflow instance     | Same — one instance, per-locale children        |
| Write target | Sibling draft or release version              | Language-keyed patches on the subject itself    |
| Start        | Publish event or operator, drafts perspective | Same, but **published perspective** (see below) |

Canonical sources:

- `packages/l10n/src/core/fieldTier.ts` — the tier's vocabulary: field
  registry, coverage (a locale counts only when every field carries it),
  source-locale projection, start perspective.
- `packages/l10n/src/handlers/translateLocale.ts` — the in-place write
  branch: one patch per container and per field, `unset` by language then
  `append`, idempotent under redelivery.
- `packages/l10n/src/workflows/localizeDocument.fieldTier.test.ts` — why
  person runs start with a published perspective: translations live in the
  subject, so a run must not mistake its own draft writes for source edits
  (`sourceChanged`), and analysis diffs only source-locale projections so a
  post-approval publish never self-triggers a new run.
- `packages/l10n/src/translations/FieldTierContent.tsx` — the inspector
  surface: `LocalizationRun` rows plus a coverage card; the compare reduces
  both copies of the document to one locale's values before diffing.

There is no `fieldTranslation.metadata` document and no per-cell state
machine — run state lives on the workflow instance, content state in the
arrays themselves.
