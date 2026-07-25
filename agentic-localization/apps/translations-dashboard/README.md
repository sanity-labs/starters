# Translations Dashboard

Real-time translations management dashboard built with the [Sanity App SDK](https://www.sanity.io/docs/app-sdk). Shows translation coverage, gaps, and stale documents across all locales — and lets you trigger AI translations to fill gaps or update stale content.

## Quick Start

```bash
# From the monorepo root — env vars are read from the root .env
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

Two realtime sources — the content dataset and the engine's `workflows` dataset —
joined once, with every derived hook a pure `useMemo` over the result. Nothing
polls and nothing caches a status. Selection and batch state are local to the
route; run progress comes from the workflow instance.
[ARCHITECTURE.md](ARCHITECTURE.md) has the join, the hook tree and the write
surface.

## Project Structure

```
src/
├── App.tsx                    Entry point — SanityApp + routing
├── routes/
│   ├── DashboardRoute.tsx     Summary view
│   └── TranslationsRoute.tsx  Action view
├── contexts/                  TranslationConfigContext — languages, config, supported types
├── hooks/                     Data + action hooks
├── components/                UI components, charts, document views
├── queries/                   GROQ projection strings
├── lib/                       Run-stage interpretation, status-icon binding, class-name helpers
├── types/                     One ambient module declaration for @sanity/workflow-components
└── consts/                    Document type lists, status constants
```

## Deploying

Deploy the dashboard (`pnpm bootstrap` already wrote your organization ID to `.env`):

```sh
pnpm --filter @starter/translations-dashboard exec sanity deploy
```

To make "Open in Studio" links point to your production Studio:

```sh
echo 'SANITY_STUDIO_URL=https://your-studio.sanity.studio' >> .env
```
