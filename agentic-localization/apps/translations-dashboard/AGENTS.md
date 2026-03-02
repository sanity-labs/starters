# AGENTS.md — Translations Dashboard

This file provides architectural context for AI coding agents working on the translations dashboard. Read this before making changes.

## Architecture Overview

### Data Flow

The entire dashboard is driven by a single GROQ query in `useTranslationAggregateData`. This hook uses `useQuery` from `@sanity/sdk-react` to fetch all `translation.metadata` documents, base documents, and locale definitions in one request. The SDK provides real-time reactivity via the Live Content API — no polling.

Seven pure derived hooks consume this data through `useMemo`:

```
useTranslationAggregateData (useQuery — single GROQ fetch, real-time)
  ├── useTranslationSummary      → SummaryBar
  ├── useStatusBreakdown         → StatusCards
  ├── useCoverageMatrix          → CoverageHeatmap
  ├── useGapDocuments            → GapCloserView
  ├── useRecentChanges           → RecentActivity
  ├── useStaleDocuments          → StaleDocumentsSection
  └── useStatusFilteredDocuments → StatusFilterView
```

These derived hooks are pure functions over already-fetched data. They do NOT make network requests or trigger Suspense.

### Context Composition

`AppContextProvider` composes three focused contexts:

```
TranslationConfigProvider (languages, config, Sanity client config)
  └── SelectionProvider (selected documents, types, batch mode, status)
        └── TranslationProgressProvider (translation progress, creation status)
```

Each context has a dedicated hook for consumption:

- `useTranslationConfig()` — config, languages, client config
- `useSelection()` — selected documents, types, batch mode
- `useTranslationProgress()` — translation progress, creation/batch status

### Route Structure

| Route           | Component           | Suspense Boundary                                                          | Content                                                            |
| --------------- | ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/`             | `DashboardRoute`    | `<Suspense fallback={<DashboardSkeleton />}>` around `DashboardContent`    | Summary bar, status cards, heatmap, stale docs, recent activity    |
| `/translations` | `TranslationsRoute` | `<Suspense fallback={<DashboardSkeleton />}>` around `TranslationsContent` | Gap closer, status filter, or gap selector (based on query params) |

Both content components read `isPending` from `useTranslationAggregateData` and apply an opacity fade during background real-time updates, avoiding Suspense re-triggers.

## Key Architectural Decisions

### Single Query, Many Derived Hooks

The aggregate query joins three document types with projections that `useDocuments` cannot express. One query powering seven derived hooks via `useMemo` is far more efficient than seven separate data-fetching hooks. This is the justified use of `useQuery` described in the SDK guidelines ("use sparingly for complex GROQ").

### `useQuery` over `useDocuments`

`useDocuments` returns lightweight `DocumentHandle` objects and is designed for lists of a single document type. The translations dashboard needs cross-type joins (`translation.metadata` -> base docs -> locales) with computed fields — this requires raw GROQ via `useQuery`.

### Context Layering

Contexts are split by concern (config vs. selection vs. progress) rather than combined into a monolithic context. This prevents unnecessary re-renders when only one concern changes.

### Route-Based Suspense

Each route has exactly one `<Suspense>` boundary at the route level. Per-item Suspense boundaries exist within list components (`StaleDocumentsSection`, `Documents`, `DocumentPrevewItem`) to allow individual items to load independently.

## SDK Hook Inventory

| SDK Hook                      | Files                                                                                                                                                                                                                                                                                             | Purpose                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `useQuery`                    | `useTranslationAggregateData`, `useTranslationParams`                                                                                                                                                                                                                                             | Complex GROQ queries for aggregation and configuration data       |
| `useDocuments`                | `Documents.tsx`                                                                                                                                                                                                                                                                                   | Paginated document list with filter, batchSize, orderings         |
| `useDocumentProjection`       | `DocumentPrevewItem`, `StaleDocumentsSection`, `DocumentItem`, `TranslationDocument`, `DocumentDetail`                                                                                                                                                                                            | Display-only field projection with viewport-based `ref` loading   |
| `useClient`                   | `TranslationConfigContext`, `TranslationStatusContext`, `useCreateMissingTranslations`, `useRetranslateStale`, `useSelectiveTranslation`, `useBatchTranslationsWithProgress`, `useAutoProvisionMetadata`, `useBatchAutoProvisionMetadata`, `useSetDocumentLanguage`, `useBulkSetDocumentLanguage` | Direct Sanity client for mutations (`client.patch`, metadata ops) |
| `useCurrentUser`              | `DashboardRoute`, `useCreateMissingTranslations`, `useSelectiveTranslation`, `useBatchTranslationsWithProgress`                                                                                                                                                                                   | Current user info for personalisation and audit trails            |
| `useAgentTranslate`           | `useCreateMissingTranslations`, `useRetranslateStale`, `useSelectiveTranslation`, `useBatchTranslationsWithProgress`                                                                                                                                                                              | AI-powered translation via Sanity Agent                           |
| `useActiveReleases`           | `useReleases`                                                                                                                                                                                                                                                                                     | Active release documents, filtered for dashboard use              |
| `useNavigateToStudioDocument` | `OpenInStudioButton`                                                                                                                                                                                                                                                                              | Deep-link to document in Sanity Studio                            |
| `SanityApp`                   | `App.tsx`                                                                                                                                                                                                                                                                                         | Root provider with `fallback={<DashboardSkeleton />}`             |

## Shared Package Dependencies

### `@starter/l10n`

All translation types, hooks, components, and utilities come from a single package.

| Import                                                                     | Usage                                         |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| `TranslationsConfig`, `ResolvedTranslationsConfig`                         | Config types for the translations plugin      |
| `TranslationWorkflowStatus`, `WorkflowStateEntry`                          | Workflow status types from the shared plugin  |
| `TranslationStatus`, `getStatusDisplay`                                    | Status display helpers (icons, labels, tones) |
| `Locale`                                                                   | Locale type definition                        |
| `GLOSSARIES_QUERY`                                                         | GROQ query for translation glossaries         |
| `assembleStyleGuide`, `extractProtectedPhrases`, `filterGlossaryByContent` | Prompt assembly for AI translations           |
| `ResolvedGlossary`, `ResolvedStyleGuide`                                   | Types for resolved config documents           |

## Pattern Deviations and Rationale

**Do NOT refactor these patterns to match generic SDK guidelines.** Each deviation is intentional and documented.

### `useQuery` instead of `useDocuments`

- **Where:** `useTranslationAggregateData`, `useTranslationParams`
- **Why:** Cross-type joins and computed projections that `useDocuments` cannot express. The aggregate query is the single data source for the entire dashboard.
- **Do NOT:** Split this into multiple `useDocuments` calls. It would increase network requests and lose the cross-type join capability.

### Two `useQuery` calls in one hook (`useTranslationParams`)

- **Where:** `useTranslationParams` fetches glossaries and style guides
- **Why:** Both datasets are always consumed together via `buildParams()`. They suspend together. Splitting into separate components adds indirection without benefit.
- **Do NOT:** Extract these into separate components with individual Suspense boundaries.

### `key={i}` on arrays

- **Where:** Skeleton components (`GapCloserViewSkeleton`, `StatusCardsSkeleton`, `BatchActionBarSkeleton`, `GapSelectorViewSkeleton`, `CoverageHeatmapSkeleton`, `RecentActivitySkeleton`), progress bar segments in `GapCloserView`
- **Why:** These render fixed-length placeholder arrays with no stable identity. They are never reordered, filtered, or individually updated. Index keys are correct.
- **Do NOT:** Add synthetic keys or refactor to use IDs.

### No `useEditDocument` / `useApplyDocumentActions`

- **Where:** Entire app
- **Why:** This is a read-heavy dashboard. All mutations go through `useAgentTranslate` (AI translations) or `useClient` + `client.patch` (metadata provisioning). There are no inline document editing forms.
- **Do NOT:** Refactor mutation code to use `useEditDocument` unless adding an inline editing feature.

### Multiple hooks in route content components

- **Where:** `DashboardContent`, `TranslationsContent`
- **Why:** Only `useTranslationAggregateData` fetches data. All other hooks (`useTranslationSummary`, `useStatusBreakdown`, `useCoverageMatrix`, etc.) are pure `useMemo` derivations over the already-fetched data. They do not trigger Suspense or make network requests.
- **Do NOT:** Split these into separate Suspense-wrapped components. They share a single data source.

## Testing and Validation

### Running the App

```bash
# From monorepo root
pnpm install

# Start the SDK app
cd apps/translations-dashboard
pnpm dev
```

### After Making Changes

1. **Type check:** `pnpm typecheck` from monorepo root (or `npx tsc --noEmit` from this directory)
2. **Lint:** `pnpm lint` from monorepo root
3. **Visual check:** Verify the dashboard route (`/`) and translations route (`/translations`) both render without errors
4. **Suspense:** Confirm skeleton fallbacks appear briefly during initial load, then content renders
5. **Real-time:** Edit a document in Sanity Studio and verify the dashboard updates without a manual refresh
