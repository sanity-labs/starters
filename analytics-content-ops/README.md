# Analytics-informed content operations

A Sanity starter that closes the loop between **analytics** and **editorial
action**. Performance signal from any analytics platform (GA4, Amplitude, Heap,
…) syncs into Sanity as derived, action-enabling signal — so editors act on it
inside Studio, developers power "trending" and "most-read" features with plain
GROQ, and Content Agent triages the catalog automatically overnight.

```sh
pnpm create sanity@latest --template sanity-labs/starters/analytics-content-ops --package-manager pnpm
```

> Using npm? Run `npm create sanity@latest -- --template sanity-labs/starters/analytics-content-ops` (note the extra `--`).

> Sanity is not the analytics platform. It's where signal from that platform
> becomes editorial action.

This demo is styled as **Friluft Media**, a Norwegian outdoor publication, using
real articles from the [Sanity blog](https://www.sanity.io/blog).

## What it demonstrates

| Persona                                    | In this starter                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author** — "how is my work doing?"       | A performance badge + read-only **Performance panel** on every article, with a one-line editorial cue. Set `editorialPriority` to flag a piece — no leaving Studio. |
| **Section editor** — triaging a section    | Structure Builder **triage views**: Needs Attention, Trending Now, Archive Candidates.                                                                              |
| **Content ops lead** — running the catalog | A **Content Agent Queue** of articles the sync flagged stale, each with agent-drafted notes and SEO staged in a draft for review.                                   |
| **Developer** — content intelligence       | A nightly **sync** upserts `articlePerformance` companion docs; the "Trending" and "Most read" rails on the site are just GROQ joins.                               |
| **Content Agent** — automated triage       | A scheduled Function loads queued articles, writes reasoning + improvements, and stages them for human review.                                                      |

## Architecture at a glance

```
Analytics platform (GA4, Amplitude, …)
  │  nightly batch
  ▼
Sync layer  ── Phase 1: GitHub Actions cron  (scripts/analytics-sync.ts)
            └─ Phase 2: Scheduled Function    (functions/analytics-sync/)
  │  classifies catalog-relative tiers, upserts companion docs,
  │  flags newly-stale articles for triage
  ▼
Sanity Content Lake
  ├── Studio: performance badge, Performance panel, triage views, editorialPriority
  ├── GROQ:   trending / most-read rails on the frontend
  └── Content Agent (functions/agent-triage/): drafts improvements → review queue
```

Both sync phases call the same `runSync` from `@starter/analytics-sync`, so the
Phase 1 → Phase 2 migration is an infrastructure swap, not a rewrite.

## Getting started

Prerequisites: **Node ≥ 20.19** and **pnpm 10**.

This starter does **not** cascade a single root `.env.local` into every workspace.
You need three separate env files before `pnpm bootstrap` will work.

```sh
pnpm install

# 1. Create all three env files (required — not optional)
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env
cp .env.example .env

# 2. Fill in the same project ID / dataset in each file
#    studio/.env     → SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET
#    frontend/.env   → NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET
#    .env (root)     → SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET
#
# A root-only `.env.local` is not enough: Studio CLI loads `studio/.env`, and
# blueprint deploy loads root `.env`. Missing either fails bootstrap with
# "Unable to resolve project ID/dataset from CLI configuration".

# 3. Deploy schema, generate types, and seed demo content + performance signal
pnpm bootstrap

# 4. Run everything (Studio :3333, frontend :3000)
pnpm dev
```

Prefer to seed without deploying functions? Run `pnpm seed` instead of
`pnpm bootstrap`. Re-run the sync any time with `pnpm analytics-sync` (needs
`SANITY_API_WRITE_TOKEN` in `.env`, or use the seed which uses your CLI login).

The default `ANALYTICS_PROVIDER=fixture` ships deterministic demo metrics, so
everything works with **no analytics credentials**. Point it at real data by
setting `ANALYTICS_PROVIDER=ga4` and implementing the GA4 provider skeleton in
`packages/@starter/analytics-sync/src/providers/ga4.ts`.

## Project structure

```
analytics-content-ops/
├── studio/                       # Sanity Studio v5
│   ├── schemaTypes/              #   article, articlePerformance, analyticsContext, author, category
│   ├── components/               #   PerformanceTierBadge, PerformancePanel
│   ├── lib/performance.ts        #   tier/lifecycle vocabulary + editorial cues
│   ├── structure.ts              #   triage views + Performance panel view
│   └── seed/                     #   demo articles + images
├── frontend/                     # Next.js 16 + React 19 + Tailwind v4
│   ├── app/                      #   home (trending rail), article pages
│   └── sanity/queries.ts         #   GROQ intelligence features
├── functions/                    # Sanity Functions
│   ├── analytics-sync/           #   Phase 2 scheduled sync
│   └── agent-triage/             #   Content Agent nightly triage
├── packages/@starter/
│   └── analytics-sync/           #   framework-agnostic sync + tier classification
├── scripts/analytics-sync.ts     # Phase 1 standalone / CI sync
├── sanity.blueprint.ts           # scheduled functions + robot token
└── .github/workflows/            # ci.yml + analytics-sync.yml (Phase 1 cron)
```

## Environment variables

Each workspace manages its own `.env` (never committed). Copy from the matching
`.env.example` and set the same project ID / dataset in all three:

| File | Loaded by | Required vars |
| --- | --- | --- |
| `studio/.env` | Studio CLI (`sanity.cli.ts` → `process.loadEnvFile`), `pnpm bootstrap`, `sanity dev` | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, optional `SANITY_STUDIO_PREVIEW_URL` |
| `frontend/.env` | Next.js | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, optional `SANITY_API_READ_TOKEN` / `NEXT_PUBLIC_SANITY_STUDIO_URL` |
| `.env` (root) | Blueprint (`dotenv/config` in `sanity.blueprint.ts`), Phase 1 sync | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `ANALYTICS_PROVIDER`, optional `SANITY_API_WRITE_TOKEN` + GA4 vars |

**Common failure:** putting values only in root `.env.local`. That file is used by
`scripts/analytics-sync.ts`, but **not** by Studio CLI or blueprint deploy. Without
`studio/.env` and root `.env`, bootstrap exits with
`Unable to resolve project ID/dataset from CLI configuration`.

## Scripts

| Command                     | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `pnpm dev`                  | Studio + frontend + functions concurrently                |
| `pnpm bootstrap`            | Deploy blueprint + schema, typegen, seed content + signal |
| `pnpm seed`                 | Seed demo content and run the fixture sync                |
| `pnpm analytics-sync`       | Run the analytics sync (Phase 1 / on demand)              |
| `pnpm build`                | Build all workspaces                                      |
| `pnpm typegen`              | Regenerate Sanity TypeGen types                           |
| `pnpm typecheck`            | Type-check all workspaces                                 |
| `pnpm lint` / `pnpm format` | Lint / format                                             |
| `pnpm validate`             | Validate the starter template structure                   |

## Key design decisions

- **Companion document, not embedded fields.** Analytics lives in
  `articlePerformance`, not on `article`, so `article._updatedAt` stays a purely
  editorial signal and webhooks can distinguish sync writes by `_type`.
- **Derived signal only.** No raw pageviews in Sanity — the analytics platform
  stays authoritative. `catalogPercentile` (0–100) is the one human-readable
  number.
- **Draft as the review gate.** The triage agent stages changes in the draft; a
  human publishes to approve. Nothing goes live automatically.

See [`AGENT.md`](./AGENT.md) for the full agent-facing guide.
