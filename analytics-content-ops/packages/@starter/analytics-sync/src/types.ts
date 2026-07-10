// Vocabulary shared with the Studio schema (`studio/lib/performance.ts`). Kept
// duplicated here so this package stays dependency-free and bundles cleanly
// into a Sanity Function.

export type PerformanceTier = 'trending' | 'stable' | 'stale' | 'new'
export type TrendDirection = 'rising' | 'flat' | 'falling'
export type LifecycleState = 'active' | 'declining' | 'dormant' | 'archive_candidate'
export type TopReferrer = 'organic' | 'social' | 'direct' | 'referral' | 'email'

// One day of traffic in the current 30-day window. Used to render the Studio
// sparkline / area chart. The analytics platform remains the system of record;
// this series is a display snapshot written by the sync.
export interface DailySession {
  date: string // YYYY-MM-DD
  sessions: number
}

// One row of *raw* analytics for an article, as returned by a provider. Most
// raw metrics stay in the pipeline and are classified into derived signal —
// except the 30-day display snapshot (sessions + daily series) which the
// Studio Performance panel needs to render GA-style traffic.
export interface AnalyticsMetric {
  slug: string
  // Sessions in the current 30-day window and the immediately preceding one,
  // used to derive trend direction and the traffic hero number.
  sessions: number
  previousSessions: number
  // Age of the article in days (derived from publishedAt when the provider
  // doesn't know it).
  ageDays: number
  topReferrer: TopReferrer
  // Optional 30-day daily series. Fixture always provides this; real providers
  // should too when they can. Missing series still get sessions30d + vs-avg.
  dailySessions?: DailySession[]
}

// The articles to fetch metrics for. `ageDays` is derived from `publishedAt` by
// the sync so providers (and classification) can reason about content age.
export interface ArticleRef {
  slug: string
  ageDays: number
}

// A provider adapts an analytics platform (GA4, Amplitude, a fixture, …) to the
// AnalyticsMetric shape. Swap providers without touching classification or the
// Sanity write path.
export interface AnalyticsProvider {
  readonly name: string
  fetchMetrics(articles: ArticleRef[]): Promise<AnalyticsMetric[]>
}

// The derived, action-enabling signal written to the companion document.
export interface PerformanceSignal {
  performanceTier: PerformanceTier
  trendDirection: TrendDirection
  lifecycleState: LifecycleState
  topReferrer: TopReferrer
  catalogPercentile: number
  // Display metrics for the Studio Performance panel (synced snapshot).
  sessions30d: number
  // Percent vs catalog average sessions. Negative = below average.
  // e.g. -15 → "15% below average", 22 → "22% above average".
  sessionsVsCatalogAvgPct: number
  dailySessions: DailySession[]
}

// Minimal structural client so the package doesn't depend on a specific
// @sanity/client version. Both `@sanity/client` and the Functions runtime
// client satisfy this.
export interface SyncClient {
  fetch<T>(query: string, params?: Record<string, unknown>, options?: {tag?: string}): Promise<T>
  mutate(mutations: unknown[], options?: {tag?: string}): Promise<unknown>
}

export interface SyncResult {
  provider: string
  syncedAt: string
  totalArticles: number
  scored: number
  newlyQueued: number
  counts: {trending: number; stable: number; stale: number; new: number; archiveCandidates: number}
}
