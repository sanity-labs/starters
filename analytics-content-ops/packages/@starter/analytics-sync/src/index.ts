import {classifyCatalog, type ClassifyOptions} from './classify'
import type {AnalyticsProvider, ArticleRef, SyncClient, SyncResult} from './types'

export * from './types'
export {classifyCatalog, DEFAULT_OPTIONS} from './classify'
export {resolveProvider, fixtureProvider, ga4Provider} from './providers'

const ARTICLES_QUERY = `*[_type == "article" && defined(slug.current)]{
  _id,
  "slug": slug.current,
  publishedAt,
  "agentStatus": agentReview.status
}`

interface ArticleRow {
  _id: string
  slug: string
  publishedAt?: string
  agentStatus?: string
}

const ONE_DAY = 1000 * 60 * 60 * 24

function ageInDays(publishedAt?: string): number {
  if (!publishedAt) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / ONE_DAY))
}

export interface RunSyncOptions {
  client: SyncClient
  provider: AnalyticsProvider
  classifyOptions?: Partial<ClassifyOptions>
  // A run id used to name the companion documents' sync batch. Defaults to now.
  now?: Date
  tagPrefix?: string
}

// The whole pipeline: read articles → fetch metrics → classify → write derived
// signal to companion documents, flag newly-stale articles for agent triage,
// and refresh the catalog summary. Pure of any framework — the CLI script and
// the scheduled Function both call this.
export async function runSync(options: RunSyncOptions): Promise<SyncResult> {
  const {client, provider, classifyOptions} = options
  const now = options.now ?? new Date()
  const syncedAt = now.toISOString()
  const tag = options.tagPrefix ?? 'analytics-sync'

  const articles = await client.fetch<ArticleRow[]>(ARTICLES_QUERY, {}, {tag: `${tag}.read`})

  const refs: ArticleRef[] = articles.map((a) => ({
    slug: a.slug,
    ageDays: ageInDays(a.publishedAt),
  }))

  const metrics = await provider.fetchMetrics(refs)
  const signals = classifyCatalog(metrics, classifyOptions)

  const bySlug = new Map(articles.map((a) => [a.slug, a]))
  const mutations: unknown[] = []
  const counts = {trending: 0, stable: 0, stale: 0, new: 0, archiveCandidates: 0}
  let newlyQueued = 0
  let scored = 0

  for (const [slug, signal] of signals) {
    const article = bySlug.get(slug)
    if (!article) continue
    const articleId = article._id.replace(/^drafts\./, '')
    scored++

    counts[signal.performanceTier]++
    if (signal.lifecycleState === 'archive_candidate') counts.archiveCandidates++

    // Companion document — deterministic id keyed by the article, so re-running
    // the sync updates in place instead of creating duplicates.
    mutations.push({
      createOrReplace: {
        _id: `articlePerformance.${articleId}`,
        _type: 'articlePerformance',
        article: {_type: 'reference', _ref: articleId},
        performanceTier: signal.performanceTier,
        trendDirection: signal.trendDirection,
        lifecycleState: signal.lifecycleState,
        topReferrer: signal.topReferrer,
        catalogPercentile: signal.catalogPercentile,
        sessions30d: signal.sessions30d,
        sessionsVsCatalogAvgPct: signal.sessionsVsCatalogAvgPct,
        dailySessions: signal.dailySessions.map((d, i) => ({
          _type: 'dailySession',
          _key: `d${i}-${d.date}`,
          date: d.date,
          sessions: d.sessions,
        })),
        syncedAt,
      },
    })

    // Flag articles that have *newly* entered the stale tier for agent triage.
    // We only touch idle/unset reviews so we never disturb work already in the
    // review pipeline.
    const idle = !article.agentStatus || article.agentStatus === 'idle'
    if (signal.performanceTier === 'stale' && idle) {
      newlyQueued++
      mutations.push({
        patch: {
          id: articleId,
          setIfMissing: {agentReview: {}},
          set: {'agentReview.status': 'queued'},
        },
      })
    }
  }

  // Catalog-level summary for cheap Content Agent context queries.
  mutations.push({
    createOrReplace: {
      _id: 'analyticsContext',
      _type: 'analyticsContext',
      totalArticles: articles.length,
      trendingCount: counts.trending,
      staleCount: counts.stale,
      archiveCandidateCount: counts.archiveCandidates,
      provider: provider.name,
      lastSyncedAt: syncedAt,
    },
  })

  if (mutations.length > 0) {
    await client.mutate(mutations, {tag: `${tag}.write`})
  }

  return {
    provider: provider.name,
    syncedAt,
    totalArticles: articles.length,
    scored,
    newlyQueued,
    counts,
  }
}
