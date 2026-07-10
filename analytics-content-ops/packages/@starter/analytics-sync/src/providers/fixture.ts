import type {AnalyticsMetric, AnalyticsProvider, ArticleRef, DailySession, TopReferrer} from '../types'

export type {ArticleRef} from '../types'

// Curated demo metrics for the seeded articles, tuned to produce a clear spread
// across the triage views: one trending, several stable, a couple of stale
// pieces, and one archive candidate. Slugs match the seed data.
const CURATED: Record<
  string,
  {sessions: number; previousSessions: number; topReferrer: TopReferrer}
> = {
  'we-dont-write-code-anymore': {sessions: 12034, previousSessions: 4200, topReferrer: 'organic'},
  'sanity-studio-v6': {sessions: 6100, previousSessions: 6300, topReferrer: 'direct'},
  'how-to-get-product-feedback-from-agents': {
    sessions: 5200,
    previousSessions: 5000,
    topReferrer: 'social',
  },
  'skills-are-how-your-company-works': {
    sessions: 4300,
    previousSessions: 2600,
    topReferrer: 'email',
  },
  'context-board-game-agent': {sessions: 3000, previousSessions: 3200, topReferrer: 'referral'},
  'build-a-conference-concierge': {sessions: 2400, previousSessions: 2600, topReferrer: 'organic'},
  'better-context-better-matches': {sessions: 900, previousSessions: 1500, topReferrer: 'organic'},
  'how-to-write-for-an-agent': {sessions: 700, previousSessions: 1400, topReferrer: 'organic'},
  'structure-powers-intelligence': {sessions: 300, previousSessions: 1200, topReferrer: 'social'},
}

const REFERRERS: TopReferrer[] = ['organic', 'social', 'direct', 'referral', 'email']
const WINDOW_DAYS = 30

// Stable pseudo-random value in [0,1) seeded by a string — keeps unknown slugs
// deterministic across runs.
function hash01(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function isoDateDaysAgo(daysAgo: number, now = new Date()): string {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// Build a realistic-looking 30-day series that sums to ~`totalSessions`, with
// weekday lift, weekend dip, and a slope implied by previous→current growth.
function buildDailySeries(
  slug: string,
  totalSessions: number,
  previousSessions: number,
  now = new Date(),
): DailySession[] {
  const growth = totalSessions / Math.max(previousSessions, 1)
  // Slope across the window: rising pieces climb, falling pieces decay.
  const slope = Math.max(-0.45, Math.min(0.55, (growth - 1) * 0.8))
  const weights: number[] = []

  for (let i = 0; i < WINDOW_DAYS; i++) {
    const t = i / (WINDOW_DAYS - 1) // 0 → oldest, 1 → newest
    const trend = 1 + slope * (t - 0.5) * 2
    const day = new Date(now)
    day.setUTCDate(day.getUTCDate() - (WINDOW_DAYS - 1 - i))
    const dow = day.getUTCDay() // 0 Sun … 6 Sat
    const weekday = dow === 0 || dow === 6 ? 0.72 : dow === 1 || dow === 5 ? 0.92 : 1.08
    const noise = 0.85 + hash01(`${slug}:${i}`) * 0.3
    weights.push(Math.max(0.15, trend * weekday * noise))
  }

  const weightSum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (w / weightSum) * totalSessions)

  // Round while preserving the total as closely as possible.
  const rounded = raw.map((v) => Math.max(0, Math.round(v)))
  let diff = totalSessions - rounded.reduce((a, b) => a + b, 0)
  let cursor = WINDOW_DAYS - 1
  while (diff !== 0 && WINDOW_DAYS > 0) {
    const step = diff > 0 ? 1 : -1
    rounded[cursor] = Math.max(0, rounded[cursor] + step)
    diff -= step
    cursor = (cursor - 1 + WINDOW_DAYS) % WINDOW_DAYS
  }

  return rounded.map((sessions, i) => ({
    date: isoDateDaysAgo(WINDOW_DAYS - 1 - i, now),
    sessions,
  }))
}

// A demo analytics source. Requires no external credentials — set
// ANALYTICS_PROVIDER=ga4 for real data.
export function fixtureProvider(): AnalyticsProvider {
  return {
    name: 'fixture',
    async fetchMetrics(articles: ArticleRef[]): Promise<AnalyticsMetric[]> {
      const now = new Date()
      return articles.map((a) => {
        const curated = CURATED[a.slug]
        if (curated) {
          return {
            slug: a.slug,
            ageDays: a.ageDays,
            ...curated,
            dailySessions: buildDailySeries(a.slug, curated.sessions, curated.previousSessions, now),
          }
        }
        // Fallback for any article not in the curated set.
        const r = hash01(a.slug)
        const sessions = Math.round(500 + r * 8000)
        const previousSessions = Math.round(sessions * (0.7 + hash01(`${a.slug}:prev`) * 0.8))
        return {
          slug: a.slug,
          ageDays: a.ageDays,
          sessions,
          previousSessions,
          topReferrer: REFERRERS[Math.floor(r * REFERRERS.length)],
          dailySessions: buildDailySeries(a.slug, sessions, previousSessions, now),
        }
      })
    },
  }
}
