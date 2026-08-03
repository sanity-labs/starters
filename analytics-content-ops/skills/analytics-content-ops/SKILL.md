---
name: analytics-content-ops
description: Overview of the analytics-informed content operations starter — how performance signal flows from an analytics platform into Sanity as derived signal, and how Studio, GROQ, and Content Agent turn it into editorial action. Trigger on: analytics content ops, performance signal, articlePerformance, triage views, trending rail, content intelligence, stale content, editorial signal.
---

# Analytics-Informed Content Operations

This starter closes the loop between an analytics platform and editorial action.
A nightly sync classifies the catalog and writes **derived signal** into Sanity;
editors act on it in Studio, developers power "trending"/"most-read" features
with GROQ, and Content Agent triages underperforming content automatically.

## Core principle

**Sanity is not the analytics platform.** Raw metrics (pageviews, sessions)
never enter Sanity. The sync classifies them into a small, human-legible
vocabulary (`performanceTier`, `trendDirection`, `lifecycleState`, `topReferrer`,
`catalogPercentile`) and writes only that. The analytics platform stays the
system of record; Sanity is where signal becomes action.

## Content model

- **`article`** (`studio/schemaTypes/article.ts`) — the editorial document. Adds
  two signal-response fields: `editorialPriority` (the editor's flag) and
  `agentReview` (state machine: `idle → queued → in_progress → staged →
approved | dismissed`), plus agent-drafted `seoTitle` / `seoDescription`.
- **`articlePerformance`** (`studio/schemaTypes/articlePerformance.ts`) — a
  **companion document**, written only by the sync, never edited by humans.
  Deterministic id `articlePerformance.<articleId>` so re-runs upsert in place.
  Deliberately separate from `article` so `article._updatedAt` stays an
  _editorial_ signal and webhooks can filter sync writes by `_type`.
- **`analyticsContext`** (`studio/schemaTypes/analyticsContext.ts`) — a read-only
  singleton with catalog-level counts for cheap Content Agent context queries.

Vocabulary is mirrored in `studio/lib/performance.ts` (Studio) and
`packages/@starter/analytics-sync/src/types.ts` (sync). Keep the two in sync.

## Joining performance to articles (GROQ)

The companion pattern means you always join by reference:

```groq
*[_type == "article" && defined(slug.current)]{
  ...,
  "performance": *[_type == "articlePerformance" && article._ref == ^._id][0]{
    performanceTier, trendDirection, lifecycleState, catalogPercentile
  }
}
```

The frontend rails live in `frontend/sanity/queries.ts`:

- `TRENDING_QUERY` — orders by `articlePerformance` where `performanceTier == "trending"`
- `MOST_READ_QUERY` — orders by `catalogPercentile desc`

## Studio surfaces

- **`PerformanceTierBadge`** (`studio/components/PerformanceTierBadge.tsx`) — a
  document badge: green "Trending", warning "Stale", red "Archive candidate".
- **Performance panel** (`studio/components/PerformancePanel.tsx`) — a read-only
  second view on every article, live-subscribed to the companion doc. Wired via
  `defaultDocumentNode` in `studio/structure.ts`.
- **Triage views** (`studio/structure.ts`) — Needs Attention, Trending Now,
  Archive Candidates, Content Agent Queue.

## The two-phase sync

Both phases call the same `runSync` from `@starter/analytics-sync`:

- **Phase 1** — `scripts/analytics-sync.ts`, run by GitHub Actions
  (`.github/workflows/analytics-sync.yml`). Needs `SANITY_API_WRITE_TOKEN`.
- **Phase 2** — `functions/analytics-sync/`, a scheduled Function registered in
  `sanity.blueprint.ts`.

Migrating Phase 1 → Phase 2 is an infrastructure swap, not a rewrite.

## Jobs to be done

- **Add a new analytics source** → see the `analytics-provider-pattern` skill.
- **Change what counts as trending/stale** → tune `ClassifyOptions` in
  `packages/@starter/analytics-sync/src/classify.ts` (catalog-relative).
- **Automate content improvement** → see the `content-agent-triage` skill.
- **Surface signal on the site** → add a GROQ join in `frontend/sanity/queries.ts`.

## References

- `packages/@starter/analytics-sync/src/index.ts` — `runSync` pipeline
- `studio/structure.ts` — triage views + performance panel wiring
- `README.md` / `AGENT.md` — setup and architecture
