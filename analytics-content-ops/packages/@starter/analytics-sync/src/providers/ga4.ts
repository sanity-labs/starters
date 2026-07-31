import type {AnalyticsMetric, AnalyticsProvider, ArticleRef} from '../types'

// GA4 provider skeleton. This is where you connect the real Google Analytics
// Data API. It intentionally throws until you wire it up so the demo never
// silently reports fabricated numbers as if they were real.
//
// Implementation sketch (Phase 1):
//   1. Read GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY (base64 JSON) from env.
//   2. Call the GA Data API `runReport` for `sessions` by `pagePath` over the
//      current and previous window, plus `sessionDefaultChannelGroup` for the
//      top referrer.
//   3. Map each article slug to its pagePath (e.g. `/article/${slug}`) and
//      return one AnalyticsMetric per matched article.
//
// The classification and Sanity write path do not change — only this file does.
export function ga4Provider(): AnalyticsProvider {
  return {
    name: 'ga4',
    async fetchMetrics(_articles: ArticleRef[]): Promise<AnalyticsMetric[]> {
      const propertyId = process.env.GA4_PROPERTY_ID
      const key = process.env.GA4_SERVICE_ACCOUNT_KEY
      if (!propertyId || !key) {
        throw new Error(
          'GA4 provider selected but GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_KEY are not set. ' +
            'Set ANALYTICS_PROVIDER=fixture for the demo, or provide GA4 credentials.',
        )
      }
      throw new Error(
        'ga4Provider is a skeleton — implement the GA Data API call in ' +
          'packages/@starter/analytics-sync/src/providers/ga4.ts',
      )
    },
  }
}
