# Architecture

## SDK Patterns Demonstrated

### Parent-Child Handle Pattern with Viewport Loading

`StaleDocumentsSection.tsx` passes document handles to `StaleDocumentRowContent`, which uses `useDocumentProjection` with a `ref` for lazy viewport-based loading. The data is only fetched when the row scrolls into view:

```tsx
function StaleDocumentRowContent({entry}: {entry: StaleDocumentEntry}) {
  const ref = useRef(null)
  const {data} = useDocumentProjection<{title?: string}>({
    documentId: entry.documentId,
    documentType: entry.documentType,
    projection: '{title}',
    ref, // only loads when visible
  })

  return <Card ref={ref}>...</Card>
}
```

This same pattern appears in `DocumentPreviewItem`, `DocumentItem`, `TranslationDocument`, and `DocumentDetail` — always with a `ref`.

### Suspense Boundaries at Every Level

The app uses Suspense at three granularities:

- **Route-level** — `DashboardRoute` and `TranslationsRoute` each wrap their content component in `<Suspense fallback={<DashboardSkeleton />}>`.
- **Per-item** — `StaleDocumentsSection` and `Documents` wrap each list row in its own `<Suspense>` with a skeleton fallback, so items load independently.
- **Per-badge** — `DocumentPreviewItem` wraps each `TranslationStatusBadge` in a `<Suspense>` with `<TranslationStatusBadgeSkeleton>`, preventing a single slow badge from blocking the entire row.

### `isPending` for Transition States

Both routes read `isPending` from `useTranslationAggregateData` and apply an opacity fade during background updates. This avoids re-triggering Suspense when the real-time subscription pushes new data:

```tsx
<div className={isPending ? 'opacity-70 transition-opacity duration-200' : ''}>
  {/* dashboard content */}
</div>
```

### `useDocuments` for Lists

`Documents.tsx` uses `useDocuments` with filter, batchSize, and orderings for paginated document lists:

```tsx
const {data, hasMore, loadMore, isPending} = useDocuments({
  documentType: selectedDocumentType,
  batchSize: 20,
  filter: documentFilter,
  orderings: [{field: '_createdAt', direction: 'desc'}],
})
```

### `useNavigateToStudioDocument`

`OpenInStudioButton.tsx` wraps the SDK hook in its own `<Suspense>` with a dimension-matched fallback to prevent layout shift:

```tsx
function OpenInStudioButton(props: OpenInStudioButtonProps) {
  return (
    <Suspense fallback={props.text ? <Spinner /> : <Button disabled icon={LaunchIcon} />}>
      <NavigateButton {...props} />
    </Suspense>
  )
}
```

### `useActiveReleases`

`useReleases.ts` wraps the SDK hook with domain-specific filtering (excluding agent-created and non-batch releases):

```tsx
const allReleases = useActiveReleases()
const releases = useMemo(
  () => allReleases.filter((r) => !r.name.startsWith('agent-') && metadata?.cardinality === 'many'),
  [allReleases],
)
```

### `useAgentTranslate`

Four action hooks use `useAgentTranslate` to trigger AI-powered translations: `useCreateMissingTranslations`, `useRetranslateStale`, `useSelectiveTranslation`, and `useBatchTranslationsWithProgress`.

### `useCurrentUser`

`DashboardRoute` personalizes the welcome header with the current user's name and profile image.

## Intentional SDK Guideline Deviations

A review against the [Sanity App SDK guidelines](https://www.sanity.io/docs/app-sdk) surfaces several apparent violations. Each is an intentional, justified decision.

### 1. `useQuery` instead of `useDocuments` in `useTranslationAggregateData`

The aggregate query joins three document types (`translation.metadata`, base docs, `locale`) with projections and filtering that `useDocuments` cannot express. A single query powering seven derived hooks is more efficient than seven separate `useDocuments` calls. The SDK guideline says to use `useQuery` "sparingly for complex GROQ" — this is exactly that use case.

### 2. `useQuery` in `useTranslationParams`

This hook fetches glossaries and style guides with nested dereferencing (`locale->{ tag, title }`). These are configuration documents, not content lists, and need joins that `useDocuments` cannot perform.

### 3. Two `useQuery` Calls in `useTranslationParams`

The "one hook per component" rule targets data-fetching hooks that independently trigger Suspense in the same component. Here, both queries (glossaries and style guides) suspend together and their data is combined into a single `buildParams` function. Splitting them into separate components would add complexity without benefit since they are always consumed together.

### 4. `key={i}` on Skeleton Arrays

Every flagged instance (`GapCloserView`, `StatusCards`, `BatchActionBar`, `GapSelectorView`, `CoverageHeatmap`, `RecentActivity/columns`) is inside a skeleton component rendering `Array.from({length: N})` for loading states. Skeleton items have no stable identity and are never reordered or filtered — index keys are the correct choice.

### 5. `key={i}` on Progress Bar Segments

The `progressSegments` array in `GapCloserView` is a fixed-order, computed list of colour/percentage segments derived from the current state. These segments have no document identity and are never reordered. Index keys are correct.

### 6. No `useEditDocument` / `useApplyDocumentActions`

This is a read-heavy dashboard. Mutations are performed via `useAgentTranslate` (AI translations) and `useClient` + `client.patch` (metadata provisioning). The SDK editing hooks are designed for inline form editing, which this app does not do.

### 7. Multiple Hooks in `DashboardContent` / `TranslationsContent`

Only one hook (`useTranslationAggregateData`) actually fetches data. All others (`useTranslationSummary`, `useStatusBreakdown`, `useCoverageMatrix`, etc.) are pure derived hooks that run `useMemo` over already-fetched data. They do not trigger additional Suspense boundaries or network requests.
