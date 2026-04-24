# Field-Level Translation Patterns

## Document-Level vs Field-Level Comparison

This starter uses two complementary translation architectures:

| Aspect          | Document-level                                                 | Field-level                                                    |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Plugin          | `@sanity/document-internationalization`                        | `sanity-plugin-internationalized-array`                        |
| Storage         | Separate document per locale (e.g., `article__i18n_es-MX`)     | Inline array entries on the same document                      |
| Metadata doc    | `translation.metadata`                                         | `fieldTranslation.metadata`                                    |
| Workflow states | `missing`, `usingFallback`, `needsReview`, `approved`, `stale` | `missing`, `needsReview`, `approved`, `stale`                  |
| Stale detection | Server-side via Sanity Functions                               | Client-side via `deriveFieldCellStates` + `useStaleSyncEffect` |
| Publish gate    | None (separate docs)                                           | `createFieldTranslationPublishGate` wraps PublishAction        |
| Inspector UI    | Translation pane (per-locale document list)                    | Field x locale matrix (FieldTranslationContent)                |
| Use case        | Full document translation (articles, pages)                    | Per-field translation (bios, descriptions, taglines)           |

**When to use which**: Use document-level when the entire document is translated
as a unit (articles, blog posts). Use field-level when only specific fields need
translation while the document itself is language-agnostic (person profiles,
product records with a translatable description field).

## Data Flow

```
Schema walk (useInternationalizedFields)
  │  Recursively finds all internationalizedArray* fields
  │  Returns InternationalizedFieldDescriptor[] (path, depth, valueType)
  │
  ▼
useFieldTranslationData(documentId, fields, locales)
  │  listenQuery for draft+published, projects only i18n fields
  │  Client-side coalesce (draft preferred over published)
  │  Derives: matrix (field×locale → filled/empty), sourceLanguages, currentSourceValues
  │  Returns: FieldTranslationSnapshot
  │
  ▼
useFieldWorkflowMetadata(documentId)
  │  listenQuery for fieldTranslation.metadata document
  │  Returns: states[], stateMap (keyed by field::language), metadataId
  │
  ▼
deriveFieldCellStates(snapshot, stateMap, currentSourceValues)
  │  Pure function: merges doc snapshot + metadata → FieldCellState matrix
  │  Applies the 6 derivation rules (see below)
  │
  ├─▶ useStaleSyncEffect(cellStates, stateMap, metadataId, ...)
  │     Debounced (500ms) — persists newly-stale entries to metadata
  │
  └─▶ FieldTranslationContent (inspector UI)
        │  Renders summary bar, matrix table, action bar
        │
        ▼
      useFieldTranslateActions(snapshot, schemaId, documentType, cellStates)
        Translate, approve, dismiss actions with semaphore concurrency
```

## The 6 Derivation Rules

`deriveFieldCellStates()` in
`packages/l10n/src/translations/deriveFieldCellStates.ts` is a pure function
that merges document state (filled/empty) with metadata workflow state into a
`FieldCellState` matrix. The rules:

| #   | Condition                                                          | Result                | Rationale                                                 |
| --- | ------------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| 1   | No array entry for this locale                                     | `missing`             | Translation doesn't exist yet                             |
| 2   | Entry exists, no metadata                                          | `approved` (implicit) | Manual/pre-existing content — no workflow tracking needed |
| 3   | Entry exists, metadata `needsReview`, source unchanged             | `needsReview`         | AI translated but not yet reviewed                        |
| 4   | Entry exists, metadata `needsReview` or `approved`, source changed | `stale`               | Source content changed since translation was done         |
| 5   | Entry exists, metadata `stale`                                     | `stale`               | Already marked stale (persisted)                          |
| 6   | Entry exists, metadata `approved`, source unchanged                | `approved`            | Reviewed and source hasn't changed                        |

**Source locale** is always implicitly `approved` (skipped from derivation).

**Staleness detection** compares `meta.sourceSnapshot` (JSON.stringify of source
value at translation time) against the current source value. If they differ, the
cell is stale regardless of its metadata status.

The test suite in `deriveFieldCellStates.test.ts` covers all 6 rules plus edge
cases (multiple fields, missing sourceSnapshot).

## Key Hooks API

### `useInternationalizedFields(documentType)`

**Purpose**: Schema walk — discovers all `internationalizedArray*` fields.

**File**: `packages/l10n/src/fieldActions/useInternationalizedFields.ts`

**Pattern**: `useMemo` keyed on `documentType` — walks `useSchema()` once per
type. Recursively descends into object fields and array members. Fields inside
arrays get `depth: -1` (excluded from bulk translate).

**When to use**: Auto-detection of which fields need the translation inspector.
The inspector only renders when this returns a non-empty array.

### `useFieldTranslationData(documentId, fields, locales)`

**Purpose**: Realtime field x locale matrix from inline array values.

**File**: `packages/l10n/src/translations/useFieldTranslationData.ts`

**Pattern**: `documentStore.listenQuery()` for both draft and published docs with
a focused GROQ projection (only i18n fields). Client-side coalesces
draft-over-published. Returns `FieldTranslationSnapshot` with matrix, source
languages, and current source values.

**When to use**: The snapshot is the foundational input for `deriveFieldCellStates`
and `useFieldTranslateActions`. Always consumed via `FieldTranslationContent`.

### `useFieldWorkflowMetadata(documentId)`

**Purpose**: Realtime subscription to `fieldTranslation.metadata` workflow states.

**File**: `packages/l10n/src/translations/useFieldWorkflowMetadata.ts`

**Pattern**: `documentStore.listenQuery()` for the metadata document. Returns
raw `states[]` array and pre-computed `stateMap` keyed by `field::language` for
O(1) lookups.

**When to use**: Paired with `deriveFieldCellStates` in the inspector. Also used
by `createFieldTranslationPublishGate` to count unresolved entries.

### `useFieldTranslateActions(snapshot, schemaId, documentType, cellStates)`

**Purpose**: Translation orchestration — translate, approve, dismiss stale.

**File**: `packages/l10n/src/translations/useFieldTranslateActions.ts`

**Pattern**: `useReducer` for per-cell in-flight state, `useTransition` for
`isTranslating`, promise-based semaphore for max concurrency, AbortController for
cancellation. Returns `translateCell`, `translateField`, `translateLocale`,
`translateAllEmpty`, `approveCell`, `approveAll`, `dismissStaleCell`.

**When to use**: Consumed by `FieldTranslationContent` for all user actions in the
matrix UI.

### `useStaleSyncEffect(cellStates, stateMap, metadataId, currentSourceValues)`

**Purpose**: Debounced lazy persistence of newly-stale entries.

**File**: `packages/l10n/src/translations/useStaleSyncEffect.ts`

**Pattern**: When `deriveFieldCellStates` detects entries that are stale
client-side but not yet persisted to metadata, this effect batch-patches them
after a 500ms debounce.

**When to use**: Always mounted inside `FieldTranslationContent`. Runs
automatically — no manual invocation.

### `useLocales()`

**Purpose**: Realtime subscription to supported languages (`l10n.locale` docs).

**File**: `packages/l10n/src/translations/useLocales.ts`

**Pattern**: Thin wrapper over `useLocalesContext()` from `contexts/LocalesContext.tsx`.
The actual `listenQuery(SUPPORTED_LANGUAGES_QUERY)` subscription lives in `LocalesProvider`,
mounted once at the plugin's `studio.components.layout` level via `L10nProvider`.
All consumers share a single EventSource connection. Returns `Language[] | undefined`
(`undefined` while loading).

**When to use**: Consumed by `FieldTranslationContent` for column headers, by
`useTranslateFieldAction` for per-locale sub-actions, by `LocaleNavbar` for the
locale filter, and by `LanguageInput` for the locale picker.

## Translation Pipeline (per-cell)

Each cell translation in `useFieldTranslateActions.processCell()` follows a
3-step process:

### Step 1: Translate with `noWrite: true`

```ts
const translated = await translate(
  {
    schemaId,
    documentId: actionDocumentId,
    fromLanguage: {id: sourceLocaleId},
    toLanguage: {id: locale.id, title: locale.title},
    target: {path: [...field.path, {_key: sourceEntry._key}, 'value']},
    noWrite: true,
  },
  doc,
)
```

**Why `noWrite`**: The Agent Actions Translate API reads the document from the
Content Lake. If we had already patched in a new array entry and then called
translate without `noWrite`, the API might not see the entry due to
replication delay — the just-committed mutation may not have propagated to the
read replica yet. Using `noWrite` avoids this race: the API translates against
the source document snapshot we provide, and returns the translated document
without writing.

### Step 2: Patch document

```ts
client
  .patch(actionDocumentId)
  .setIfMissing({[fieldName]: []})
  .unset([`${fieldName}[language=="${locale.id}"]`])
  .append(fieldName, [
    {_key: entryKey, _type: itemType, language: locale.id, value: translatedEntry.value},
  ])
  .commit()
```

The `setIfMissing` + `unset` + `append` pattern ensures idempotency — if an
entry for this locale already exists, it's replaced.

### Step 3: Patch metadata

```ts
tx.createIfNotExists({_id: metadataId, _type: 'fieldTranslation.metadata', ...})
tx.patch(metadataId, (p) =>
  p.setIfMissing({workflowStates: []})
   .unset([`workflowStates[_key=="bio--fr-FR"]`])
   .append('workflowStates', [{
     _key: 'bio--fr-FR',
     field: 'bio',
     language: 'fr-FR',
     status: 'needsReview',
     source: 'ai',
     updatedAt: new Date().toISOString(),
     sourceSnapshot: JSON.stringify(sourceEntry.value),
   }])
)
```

The `sourceSnapshot` is critical — it records the exact source value at
translation time so `deriveFieldCellStates` can detect staleness later when
the source changes.

## Publish Gate

`createFieldTranslationPublishGate` in
`packages/l10n/src/translations/useFieldTranslationPublishGate.ts` wraps any
`DocumentActionComponent` (typically PublishAction).

**How it works**:

1. Renders the wrapped action normally
2. Subscribes to `useFieldWorkflowMetadata` for the document
3. Counts `needsReview` and `stale` entries
4. If any unresolved entries exist, sets `disabled: true` with a tooltip
   explaining what needs attention

**Where it's wired**: In `plugin.ts`, the `document.actions` callback maps over
the default actions and wraps any action with `action === 'publish'`. It only
applies to document types NOT in `localizedSchemaTypes` (i.e., types that use
field-level, not document-level, translation).

**Customization**: To add a force-publish escape hatch, modify the gate function
to check a condition (e.g., user role) before returning `disabled: true`.

## Concurrency Control

`useFieldTranslateActions` uses a `createSemaphore(5)` to limit concurrent
translation API calls. Each cell gets its own `AbortController` for cancellation
on unmount.

**File**: `packages/l10n/src/translations/createSemaphore.ts`

The `MAX_CONCURRENT = 5` constant is defined at the top of
`useFieldTranslateActions.ts`. Reducing this value reduces API pressure but
slows bulk "translate all" operations.

## Field Actions (AI Assist Integration)

`useTranslateFieldAction` in `packages/l10n/src/fieldActions/useTranslateFieldAction.ts`
wires into `@sanity/assist`'s field action system. For each
`internationalizedArray*` field, it creates a "Translate" action group with
per-locale sub-actions ("Translate to French", "Translate to German", etc.).

This is separate from the bulk inspector UI — it provides inline translate
actions directly on each field in the document form. It uses the same `noWrite`
pattern as `useFieldTranslateActions.processCell()` but does not track workflow
metadata (no `needsReview` state). It's a quick-translate convenience for editors
working directly in the form.

## Metadata Schema

The `fieldTranslation.metadata` schema
(`packages/l10n/src/schemas/fieldTranslationMetadata.ts`) has these properties:

- **`liveEdit: true`** — patches write directly to published (no draft/publish
  cycle). This is essential because metadata updates happen frequently during
  translation workflows.
- **`hidden: true`** — not visible in desk structure. Internal document only.
- **Deterministic ID**: `fieldTranslation.metadata.<publishedId>` via
  `getFieldTranslationMetadataId()` in `packages/l10n/src/core/fieldMetadataIds.ts`.
  Never create these documents manually.

## Key Type Definitions

From `packages/l10n/src/core/types.ts`:

- **`FieldWorkflowStateEntry`** — a single entry in the metadata
  `workflowStates` array: `field`, `language`, `status`, `source`, `updatedAt`,
  `reviewedBy`, `sourceSnapshot`
- **`FieldCellState`** — merged state for one cell in the matrix: `status`
  (`missing` | `needsReview` | `approved` | `stale`), plus optional `source`,
  `sourceSnapshot`, `reviewedBy`, `updatedAt`
