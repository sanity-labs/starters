---
name: analytics-provider-pattern
description: Build analytics-platform-agnostic sync providers. Core AnalyticsProvider interface, fixture reference implementation, GA4 skeleton, and how to add Amplitude/Heap/Plausible. Trigger on: analytics provider, add analytics source, GA4 integration, fetchMetrics, provider adapter, sync classification, tier tuning.
---

# Analytics Provider Pattern

Make the sync work with any analytics platform by writing one small adapter. The
pattern separates **fetching raw metrics** (provider) from **classifying them**
(catalog-relative) and **writing derived signal** (Sanity). Adding Amplitude or
Heap means writing a new provider, never touching classification or the write
path.

## Core principle

**Open–closed.** A new analytics source adds a new provider module and one
`case` in `resolveProvider`. The classification (`classify.ts`) and Sanity write
path (`index.ts` → `runSync`) never change. The provider's only job is to return
`AnalyticsMetric[]`.

## Package: `@starter/analytics-sync`

Lives at `packages/@starter/analytics-sync/`, framework-agnostic so it bundles
cleanly into a Sanity Function.

**Exports:**

- `.` — `runSync`, `classifyCatalog`, `resolveProvider`, and all types
- `./providers` — `resolveProvider`, `fixtureProvider`, `ga4Provider`

## The interface

```typescript
export interface ArticleRef {
  slug: string
  ageDays: number // derived from publishedAt by the sync
}

export interface AnalyticsMetric {
  slug: string
  sessions: number // current window
  previousSessions: number // prior window — drives trend direction
  ageDays: number
  topReferrer: TopReferrer // 'organic' | 'social' | 'direct' | 'referral' | 'email'
}

export interface AnalyticsProvider {
  readonly name: string
  fetchMetrics(articles: ArticleRef[]): Promise<AnalyticsMetric[]>
}
```

A provider is handed the article refs the sync wants metrics for and returns one
`AnalyticsMetric` per article it has data for. Raw metrics stop here — they are
never written to Sanity.

## Reference implementation: fixture

`src/providers/fixture.ts` produces deterministic demo metrics (curated per
slug so the seeded catalog spans every tier) — no credentials required. It is
the default (`ANALYTICS_PROVIDER=fixture`) and drives `pnpm seed`.

## Skeleton: GA4

`src/providers/ga4.ts` throws until implemented, so the demo never reports
fabricated numbers as real. Implementation sketch:

1. Read `GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_KEY` from env.
2. Call the GA Data API `runReport` for `sessions` by `pagePath` over the current
   and previous window, plus `sessionDefaultChannelGroup` for the top referrer.
3. Map each slug to its `pagePath` (e.g. `/article/${slug}`) and return one
   `AnalyticsMetric` per matched article.

## How to add a new provider (Amplitude example)

### Step 1 — create the module

```typescript
// packages/@starter/analytics-sync/src/providers/amplitude.ts
import type {AnalyticsMetric, AnalyticsProvider, ArticleRef} from '../types'

export function amplitudeProvider(): AnalyticsProvider {
  return {
    name: 'amplitude',
    async fetchMetrics(articles: ArticleRef[]): Promise<AnalyticsMetric[]> {
      const apiKey = process.env.AMPLITUDE_API_KEY
      if (!apiKey) throw new Error('AMPLITUDE_API_KEY not set')
      // Query Amplitude for sessions per article path, current + previous window,
      // then map to AnalyticsMetric.
      return articles.map((a) => ({
        slug: a.slug,
        sessions: 0,
        previousSessions: 0,
        ageDays: a.ageDays,
        topReferrer: 'organic',
      }))
    },
  }
}
```

### Step 2 — register it in `resolveProvider`

```typescript
// packages/@starter/analytics-sync/src/providers/index.ts
case 'amplitude':
  return amplitudeProvider()
```

Also re-export it and select it with `ANALYTICS_PROVIDER=amplitude`. **No other
file changes** — classification and the write path are untouched.

## Tuning classification (not the provider)

To change what "trending" or "stale" means, edit `ClassifyOptions` in
`src/classify.ts`. Tiers are **catalog-relative** — a piece is stale compared to
its peers, not against an absolute pageview number:

- `trendingTopFraction` (0.1) — top 10% by session growth, and `rising`
- `staleBottomFraction` (0.25) + `staleMinAgeDays` (90) — bottom quartile once
  old enough
- `newMaxAgeDays` (14) — always "new" while young
- `risingRatio` / `fallingRatio` — trend thresholds vs. the previous window
- `archiveMinAgeDays` (180) — old + bottom-15th percentile + not rising →
  `archive_candidate`

Pass overrides via `runSync({classifyOptions: {...}})` (e.g. per-section tuning).

## References

- `packages/@starter/analytics-sync/src/types.ts` — interfaces
- `packages/@starter/analytics-sync/src/providers/` — fixture + ga4
- `packages/@starter/analytics-sync/src/classify.ts` — tier logic
- `packages/@starter/analytics-sync/src/index.ts` — `runSync` pipeline
