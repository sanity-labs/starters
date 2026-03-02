# Translations Dashboard

Real-time translations management dashboard built with the [Sanity App SDK](https://www.sanity.io/docs/app-sdk). Shows translation coverage, gaps, and stale documents across all locales — and lets you trigger AI translations to fill gaps or update stale content.

## Quick Start

```bash
# From the monorepo root — env vars are read from the root .env.local
pnpm install
pnpm bootstrap
pnpm dev
```

The dashboard opens at [localhost:3334](http://localhost:3334).

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Framework  | React 19, TypeScript               |
| Sanity SDK | `@sanity/sdk`, `@sanity/sdk-react` |
| UI         | `@sanity/ui`, Tailwind CSS v4      |
| Routing    | React Router v7                    |
| Charts     | Recharts                           |
| Tables     | TanStack Table                     |

## What It Does

### Dashboard Route (`/`)

Summary view: status cards showing translation counts by state, a coverage heatmap across locales, stale documents needing attention, and recent translation activity.

### Translations Route (`/translations`)

Action view: fill coverage gaps with AI translation, filter documents by status, or select specific gaps to address. Supports batch operations across multiple documents and locales.

## Architecture

The dashboard is powered by a single GROQ query (`useTranslationAggregateData`) that fetches the full translation corpus. Seven pure derived hooks process this data into chart-ready shapes using `useMemo` — one real-time subscription, no polling.

```
useTranslationAggregateData (useQuery → single GROQ fetch)
  ├── useTranslationSummary
  ├── useStatusBreakdown
  ├── useCoverageMatrix
  ├── useGapDocuments
  ├── useRecentChanges
  ├── useStaleDocuments
  └── useStatusFilteredDocuments
```

Three focused contexts compose in a provider chain:

```
TranslationConfigProvider (languages, config, client)
  └── SelectionProvider (selected documents, types, batch mode)
        └── TranslationProgressProvider (translation progress, creation status)
```

For detailed SDK patterns and intentional guideline deviations, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Project Structure

```
src/
├── App.tsx                    Entry point — SanityApp + routing
├── routes/
│   ├── DashboardRoute.tsx     Summary view
│   └── TranslationsRoute.tsx  Action view
├── contexts/                  Provider chain (config, selection, progress)
├── hooks/                     Data + action hooks
├── components/                UI components, charts, document views
├── queries/                   GROQ projection strings
├── lib/                       Translation execution, metadata ops
├── types/                     TypeScript interfaces
└── consts/                    Document type lists, status constants
```

## Deploying

Add your organization ID to the root `.env.local`, then deploy:

```sh
echo 'SANITY_STUDIO_ORGANIZATION_ID=your-org-id' >> .env.local
pnpm --filter @starter/translations-dashboard exec sanity deploy
```

To make "Open in Studio" links point to your production Studio:

```sh
echo 'SANITY_STUDIO_URL=https://your-studio.sanity.studio' >> .env.local
```
