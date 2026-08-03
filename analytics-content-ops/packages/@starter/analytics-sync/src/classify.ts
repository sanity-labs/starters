import type {AnalyticsMetric, LifecycleState, PerformanceSignal, TrendDirection} from './types'

// Tuning knobs for tier classification. Tiers are catalog-*relative*: a piece
// is "stale" compared to its peers, not against an absolute pageview number.
// Adjust these in one place (or per-section in a real deployment).
export interface ClassifyOptions {
  // Fraction of the catalog (by session growth) that counts as trending.
  trendingTopFraction: number
  // Fraction of the catalog (by sessions) that counts as stale…
  staleBottomFraction: number
  // …but only once an article is older than this many days.
  staleMinAgeDays: number
  // Articles younger than this are always classified "new".
  newMaxAgeDays: number
  // Growth thresholds for trend direction, as a ratio vs. the previous window.
  risingRatio: number
  fallingRatio: number
  // Age past which a low-traffic, falling article becomes an archive candidate.
  archiveMinAgeDays: number
}

export const DEFAULT_OPTIONS: ClassifyOptions = {
  trendingTopFraction: 0.1,
  staleBottomFraction: 0.25,
  staleMinAgeDays: 90,
  newMaxAgeDays: 14,
  risingRatio: 1.2,
  fallingRatio: 0.8,
  archiveMinAgeDays: 180,
}

function trendOf(m: AnalyticsMetric, o: ClassifyOptions): TrendDirection {
  const prev = m.previousSessions || 1
  const ratio = m.sessions / prev
  if (ratio >= o.risingRatio) return 'rising'
  if (ratio <= o.fallingRatio) return 'falling'
  return 'flat'
}

function lifecycleOf(
  m: AnalyticsMetric,
  trend: TrendDirection,
  percentile: number,
  o: ClassifyOptions,
): LifecycleState {
  if (m.ageDays >= o.archiveMinAgeDays && percentile <= 15 && trend !== 'rising') {
    return 'archive_candidate'
  }
  if (percentile <= 10 && trend === 'falling') return 'dormant'
  if (trend === 'falling') return 'declining'
  return 'active'
}

// Classify the whole catalog at once — percentile and top/bottom cutoffs are
// only meaningful relative to the full set of metrics.
export function classifyCatalog(
  metrics: AnalyticsMetric[],
  options: Partial<ClassifyOptions> = {},
): Map<string, PerformanceSignal> {
  const o = {...DEFAULT_OPTIONS, ...options}
  const result = new Map<string, PerformanceSignal>()
  if (metrics.length === 0) return result

  // Rank by sessions to derive catalog percentile (0–100).
  const bySessions = [...metrics].sort((a, b) => a.sessions - b.sessions)
  const rank = new Map<string, number>()
  bySessions.forEach((m, i) => rank.set(m.slug, i))

  // Session growth ranking feeds the trending cutoff.
  const growth = (m: AnalyticsMetric) => m.sessions / (m.previousSessions || 1)
  const byGrowth = [...metrics].sort((a, b) => growth(b) - growth(a))
  const trendingCutoff = Math.max(1, Math.ceil(metrics.length * o.trendingTopFraction))
  const trendingSlugs = new Set(byGrowth.slice(0, trendingCutoff).map((m) => m.slug))

  const staleCutoffIndex = Math.floor(metrics.length * o.staleBottomFraction)

  // Catalog-average 30-day sessions — used for the "X% above/below average" cue.
  const catalogAvgSessions =
    metrics.reduce((sum, m) => sum + m.sessions, 0) / Math.max(metrics.length, 1)

  for (const m of metrics) {
    const percentile = Math.round((rank.get(m.slug)! / (metrics.length - 1 || 1)) * 100)
    const trend = trendOf(m, o)

    let tier: PerformanceSignal['performanceTier']
    if (m.ageDays < o.newMaxAgeDays) {
      tier = 'new'
    } else if (trendingSlugs.has(m.slug) && trend === 'rising') {
      tier = 'trending'
    } else if (rank.get(m.slug)! < staleCutoffIndex && m.ageDays >= o.staleMinAgeDays) {
      tier = 'stale'
    } else {
      tier = 'stable'
    }

    const lifecycleState = lifecycleOf(m, trend, percentile, o)
    const sessionsVsCatalogAvgPct =
      catalogAvgSessions > 0
        ? Math.round(((m.sessions - catalogAvgSessions) / catalogAvgSessions) * 100)
        : 0

    result.set(m.slug, {
      performanceTier: tier,
      trendDirection: trend,
      lifecycleState,
      topReferrer: m.topReferrer,
      catalogPercentile: percentile,
      sessions30d: m.sessions,
      sessionsVsCatalogAvgPct,
      dailySessions: m.dailySessions ?? [],
    })
  }

  return result
}
