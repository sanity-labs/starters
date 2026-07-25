# Architecture

An App SDK app over two data sources, joined once.

| Source                             | Owns                                                                | Read through                                                           |
| ---------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Content dataset                    | Which translations exist, which locale falls back to which          | one GROQ query, `useQuery` (Live Content API)                          |
| `workflows` dataset (engine state) | Which runs are open, which locales they cover, review + drift flags | `useWorkflowInstances` / `useWorkflowSession` (App SDK document store) |

Both are realtime. Nothing polls, nothing caches a status.

## The join

`hooks/useTranslationAggregateData.ts` is the only fetch. It runs the GROQ query,
takes the open runs from `hooks/useLocalizationRuns.ts`, and keys them by base
document id. Every other hook is a pure `useMemo` over the result:

```
useTranslationAggregateData
  ├── useTranslationSummary      → charts/SummaryBar
  ├── useStatusBreakdown         → StatusCards
  ├── useCoverageMatrix          → charts/CoverageHeatmap, GapSelectorView
  ├── useGapDocuments            → GapCloserView
  ├── useStatusFilteredDocuments → StatusFilterView
  └── useStaleDocuments          → StaleDocumentsSection
```

`lib/localizationRun.ts` is where stage names are interpreted, and the only
place. `lib/localizationRun.test.ts` is its spec — read that before changing the
mapping.

## Writing

`hooks/useStartLocalization.ts` is the whole write surface: `startInstance`, plus
`tick` when a document already has a run. Drafts start one `localize-document`
per document; a release starts one `localize-campaign` over the batch. Instance
ids are `sha256(publishedId:_rev)`, identical to `functions/start-localization`,
so a double-click resumes rather than duplicates.

Fan-out, retries, concurrency, review gates and publishing belong to the
definitions in `packages/l10n/src/workflows/`. Do not reimplement any of them
here.

## Reference

- Definitions (stage names, actions, fields): `packages/l10n/src/workflows/`
- Engine behaviour verified against the real thing: `docs/WORKFLOW_ENGINE_MIGRATION.md` §2–§4
- Engine coordinates (dataset, tag): `src/consts/workflows.ts`, mirroring
  `sanity.blueprint.ts` and `sanity.workflow.ts`
