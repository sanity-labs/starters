# Analytics Content Ops — Agent Guide

Analytics-informed content operations starter. Performance signal from any
analytics platform flows into Sanity as **derived, action-enabling signal** so
editors act on it in Studio, developers power content-intelligence features with
GROQ, and Content Agent triages the catalog automatically.

## Stack

- **Studio** — Sanity Studio v5 (`studio/`): schemas, triage views, performance badge + panel
- **Frontend** — Next.js 16 + React 19 + Tailwind v4 (`frontend/`): media site + GROQ intelligence rails
- **Functions** — Sanity Functions (`functions/`): scheduled analytics sync + Content Agent triage
- **Sync logic** — framework-agnostic package (`packages/@starter/analytics-sync/`)

## Commands

Run from the repo root:

- `pnpm install` — install all workspaces
- `pnpm dev` — Studio (3333), frontend (3000), functions concurrently
- `pnpm bootstrap` — deploy blueprint + schema, typegen, seed content + signal
- `pnpm seed` — seed demo content and run the fixture sync
- `pnpm analytics-sync` — run the analytics sync on demand (Phase 1 path)
- `pnpm fn:sync` / `pnpm fn:triage` — run the `analytics-sync` / `agent-triage`
  Function locally (loads root `.env` + your CLI token, no deploy needed)
- `pnpm typegen` / `pnpm typecheck` / `pnpm lint` / `pnpm format`

## Environment setup (required before bootstrap)

This starter does **not** cascade a single root `.env.local`. Create and fill
**all three** files before `pnpm bootstrap`:

```sh
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env
cp .env.example .env
```

| File            | Who loads it                                   | Must set                                                      |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `studio/.env`   | `studio/sanity.cli.ts` (`process.loadEnvFile`) | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`           |
| `frontend/.env` | Next.js                                        | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` |
| `.env` (root)   | `sanity.blueprint.ts` via `dotenv/config`      | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`           |

If only root `.env.local` exists, bootstrap fails with
`Unable to resolve project ID/dataset from CLI configuration`.

## Code style

- ESM-first (`"type": "module"`), no semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`
- Shared configs in `packages/@starter/` (eslint, tsconfig, sanity-types, analytics-sync)

## Content model (the key architectural decisions)

- **`article`** — the editorial document. Adds `editorialPriority` (the editor's
  response to signal) and an `agentReview` object (workflow status:
  `idle → queued → in_progress → staged`, reset to `idle` once a human accepts or
  dismisses; the outcome is recorded by `reviewedAt`, not a status) plus
  `seoTitle` / `seoDescription` that the triage agent drafts.
- **`articlePerformance`** — a **companion document**, synced nightly, **never
  edited by humans**. It is deliberately separate from `article` so that
  `article._updatedAt` stays a purely _editorial_ signal and webhooks can filter
  sync writes by `_type`. Join with
  `*[_type == "articlePerformance" && article._ref == ^._id][0]`.
- **Derived signal + display snapshot** — Sanity stores `performanceTier`,
  `trendDirection`, `lifecycleState`, `topReferrer`, `catalogPercentile`, plus a
  Studio display snapshot (`sessions30d`, `sessionsVsCatalogAvgPct`,
  `dailySessions`) written by the sync. The analytics platform stays the system
  of record; Sanity is where signal becomes action.
- **`analyticsContext`** — a read-only singleton with catalog-level counts for
  cheap Content Agent context queries.

Vocabulary lives in two mirrored places: `studio/lib/performance.ts` (Studio)
and `packages/@starter/analytics-sync/src/types.ts` (sync). Keep them in sync.

## The sync pipeline (two phases, one codebase)

The real work lives in `@starter/analytics-sync` (`runSync`). Two thin
entrypoints call it with identical logic:

- **Phase 1 (ships today):** `scripts/analytics-sync.ts`, run by the GitHub
  Actions cron in `.github/workflows/analytics-sync.yml`. Needs
  `SANITY_API_WRITE_TOKEN`.
- **Phase 2 (Sanity-native):** `functions/analytics-sync/` scheduled Function,
  registered in `sanity.blueprint.ts`. Migrating is an infrastructure swap —
  retire the workflow, keep the logic.

Providers are pluggable (`src/providers/`). `fixture` (default) needs no
credentials and drives the demo; `ga4` is a skeleton to fill in with the GA Data
API. Select via `ANALYTICS_PROVIDER`.

Classification is catalog-relative (`src/classify.ts`): tiers/percentiles are
computed across the whole catalog, so "stale" means "underperforming its peers."

## Content Agent triage

`functions/agent-triage/` runs 30 min after the sync. It loads
`agentReview.status == "queued"` articles, uses Agent Actions to write
`agentReview.agentNotes` plus improved SEO metadata into the article's **draft**
(never the published doc — the draft is the review gate), and marks each
`staged`. The ops lead finds these under **Triage → Awaiting Approval** and
**publishes to accept** — a publish-event Function (`functions/agent-review-resolve/`)
then resets the article to `idle` — or uses the **Dismiss** action to reject,
which discards the draft and resets it. Either path stamps
`agentReview.reviewedAt`, which the sync honours as a re-queue cooldown.

Production upgrade (Enterprise-only): promote the per-run batch to a first-class
**Content Release** via the Releases API (the batch name is tracked in
`agentReview.releaseId`).

## Studio surfaces

- `PerformanceTierBadge` — document badge (trending / stale / archive candidate)
- Performance panel — read-only second view on every article
  (`structure.ts` → `defaultDocumentNode`), live-subscribed to the companion doc
- Triage views in `structure.ts`: Awaiting Approval (staged — needs a human),
  Underperforming, Trending Now, Archive Candidates, Content Agent Queue

## Deploying functions

Build from `functions/`, deploy the blueprint from the **repo root**:

```sh
pnpm --filter @starter/functions build
npx sanity blueprints deploy   # run from repo root, not functions/
```

Set the schema id for Agent Actions on the function runtime, or via `.env`
(`SANITY_SCHEMA_ID`) so the blueprint injects it.
