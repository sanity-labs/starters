import {useEffect, useState} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  useClient,
  type DocumentBadgeComponent,
  type DocumentBadgeDescription,
} from 'sanity'
import {defineQuery} from 'groq'
import {TIER_LABELS, type PerformanceTier} from '../lib/performance'

// The companion document holds the signal; join to it from the article _id.
const TIER_QUERY = defineQuery(
  `*[_type == "articlePerformance" && article._ref == $id][0]{performanceTier, lifecycleState}`,
)

type TierResult = {performanceTier?: PerformanceTier; lifecycleState?: string} | null

// Only the tiers worth surfacing get a badge — stable/new stay quiet to reduce
// noise, matching the "reduce noise" decision in the PRD.
const TIER_COLORS: Partial<Record<PerformanceTier, DocumentBadgeDescription['color']>> = {
  trending: 'success',
  stale: 'warning',
}

export const PerformanceTierBadge: DocumentBadgeComponent = (props) => {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const [result, setResult] = useState<TierResult>(null)

  const id = (props.published?._id ?? props.draft?._id ?? '').replace(/^drafts\./, '')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    client
      .fetch<TierResult>(TIER_QUERY, {id}, {tag: 'article.badge.tier'})
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch(() => {
        // badge is best-effort; stay silent if the companion doc can't load
      })
    return () => {
      cancelled = true
    }
  }, [client, id])

  const tier = result?.performanceTier

  // Archive candidate is a lifecycle state, not a tier — surface it in red.
  if (result?.lifecycleState === 'archive_candidate') {
    return {label: 'Archive candidate', color: 'danger', title: 'Flagged as an archive candidate'}
  }

  if (!tier || !(tier in TIER_COLORS)) return null

  return {
    label: TIER_LABELS[tier],
    color: TIER_COLORS[tier],
    title: `Performance tier: ${TIER_LABELS[tier]}`,
  }
}
