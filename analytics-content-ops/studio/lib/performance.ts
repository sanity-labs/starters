// Shared vocabulary for the analytics signal that flows into Sanity.
//
// Per the "action-enabling signals only" decision, Sanity is not the analytics
// platform. The sync writes *derived* tiers/lifecycle plus a small display
// snapshot (`sessions30d`, vs-average %, daily series) so the Studio
// Performance panel can render GA-style traffic without leaving Studio.
// Raw analytics remain in the provider (GA4, Amplitude, fixture, …).

export const PERFORMANCE_TIERS = ['trending', 'stable', 'stale', 'new'] as const
export type PerformanceTier = (typeof PERFORMANCE_TIERS)[number]

export const TREND_DIRECTIONS = ['rising', 'flat', 'falling'] as const
export type TrendDirection = (typeof TREND_DIRECTIONS)[number]

export const LIFECYCLE_STATES = ['active', 'declining', 'dormant', 'archive_candidate'] as const
export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

export const TOP_REFERRERS = ['organic', 'social', 'direct', 'referral', 'email'] as const
export type TopReferrer = (typeof TOP_REFERRERS)[number]

// The editor's response to the signal — set by hand, never by the sync.
export const EDITORIAL_PRIORITIES = ['needs_update', 'promote', 'archive', 'monitor'] as const
export type EditorialPriority = (typeof EDITORIAL_PRIORITIES)[number]

// The agent-review workflow position of the *live* article:
//   idle → queued (sync) → in_progress → staged (triage)
// The human then resolves it through the document lifecycle, not a status:
//   - accept  = publish the staged draft (a Function resets status to idle and
//               stamps reviewedAt)
//   - dismiss = the "Dismiss suggestion" action discards the draft and does the
//               same reset
// So "approved"/"dismissed" are *outcomes* recorded by reviewedAt, never the
// live article's status — a resolved article is simply back to idle.
export const AGENT_REVIEW_STATUSES = ['idle', 'queued', 'in_progress', 'staged'] as const
export type AgentReviewStatus = (typeof AGENT_REVIEW_STATUSES)[number]

export const TIER_LABELS: Record<PerformanceTier, string> = {
  trending: 'Trending',
  stable: 'Stable',
  stale: 'Stale',
  new: 'New',
}

// A short, human-readable cue for each (tier × lifecycle) combination. This is
// the "one-line editorial cue" surfaced on the Performance panel — enough
// signal to act on without opening the analytics platform.
export function editorialCue(tier?: PerformanceTier, lifecycle?: LifecycleState): string {
  const key = `${tier ?? 'new'}:${lifecycle ?? 'active'}`
  const cues: Record<string, string> = {
    'trending:active': 'Riding a wave — consider a follow-up or promoting it wider.',
    'trending:declining': 'Still hot but cooling — refresh the hook while attention lasts.',
    'trending:dormant': 'Spiking after a quiet spell — find out what drove the resurgence.',
    'trending:archive_candidate':
      'Unexpected traffic on an old piece — update facts before promoting.',
    'stable:active': 'Dependable performer — leave it be, or add internal links.',
    'stable:declining': 'Slowly slipping — a light refresh could hold the line.',
    'stable:dormant': 'Quiet but steady — candidate for an evergreen refresh.',
    'stable:archive_candidate': 'Low traffic and aging — review whether it still earns its place.',
    'stale:active': 'Getting views but underperforming peers — sharpen the angle.',
    'stale:declining': 'Losing traction — prioritize a rewrite or new data.',
    'stale:dormant': 'Little traffic and going cold — queue for agent triage.',
    'stale:archive_candidate':
      'Underperforming and outdated — strong archive or rewrite candidate.',
    'new:active': 'Too new to judge — check back once analytics have synced.',
    'new:declining': 'Early drop-off — revisit the headline and intro.',
    'new:dormant': 'Launched quietly — consider redistribution.',
    'new:archive_candidate': 'Never found an audience — reassess the topic.',
  }
  return cues[key] ?? 'No editorial cue yet — waiting on the next analytics sync.'
}
