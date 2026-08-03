import {defineField, defineType} from 'sanity'
import {TrendUpwardIcon} from '@sanity/icons'
import {
  LIFECYCLE_STATES,
  PERFORMANCE_TIERS,
  TIER_LABELS,
  TOP_REFERRERS,
  TREND_DIRECTIONS,
} from '../lib/performance'

// Companion document, synced nightly from the analytics platform. Never edited
// by humans — kept separate from `article` so that `article._updatedAt` stays a
// purely *editorial* signal and webhooks can filter sync writes by `_type`.
export const articlePerformance = defineType({
  name: 'articlePerformance',
  title: 'Article performance',
  type: 'document',
  icon: TrendUpwardIcon,
  // Read-only in the Studio: this data is owned by the sync, not editors.
  readOnly: true,
  fields: [
    defineField({
      name: 'article',
      type: 'reference',
      to: [{type: 'article'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'performanceTier',
      title: 'Performance tier',
      type: 'string',
      options: {list: PERFORMANCE_TIERS.map((value) => ({value, title: TIER_LABELS[value]}))},
    }),
    defineField({
      name: 'trendDirection',
      title: 'Trend direction',
      type: 'string',
      options: {list: [...TREND_DIRECTIONS]},
    }),
    defineField({
      name: 'lifecycleState',
      title: 'Lifecycle state',
      type: 'string',
      options: {list: [...LIFECYCLE_STATES]},
    }),
    defineField({
      name: 'topReferrer',
      title: 'Top referrer',
      type: 'string',
      options: {list: [...TOP_REFERRERS]},
    }),
    defineField({
      name: 'catalogPercentile',
      title: 'Catalog percentile',
      type: 'number',
      description: 'Relative performance across the catalog, 0–100. The one human-readable number.',
      validation: (rule) => rule.min(0).max(100),
    }),
    defineField({
      name: 'sessions30d',
      title: '30-day traffic',
      type: 'number',
      description:
        'Sessions in the last 30 days — a synced display snapshot for the Performance panel. The analytics platform remains the system of record.',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'sessionsVsCatalogAvgPct',
      title: 'Vs catalog average (%)',
      type: 'number',
      description:
        'Percent difference vs the catalog average 30-day sessions. Negative means below average.',
    }),
    defineField({
      name: 'dailySessions',
      title: 'Daily sessions (30 days)',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'dailySession',
          fields: [
            defineField({name: 'date', type: 'date', validation: (rule) => rule.required()}),
            defineField({
              name: 'sessions',
              type: 'number',
              validation: (rule) => rule.required().min(0),
            }),
          ],
          preview: {
            select: {date: 'date', sessions: 'sessions'},
            prepare({date, sessions}) {
              return {title: date ?? '—', subtitle: `${sessions ?? 0} sessions`}
            },
          },
        },
      ],
    }),
    defineField({
      name: 'syncedAt',
      title: 'Synced at',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      title: 'article.title',
      tier: 'performanceTier',
      percentile: 'catalogPercentile',
      sessions: 'sessions30d',
    },
    prepare({title, tier, percentile, sessions}) {
      const parts = [tier ? TIER_LABELS[tier as keyof typeof TIER_LABELS] : 'Unsynced']
      if (typeof sessions === 'number') parts.push(`${sessions.toLocaleString()} sess`)
      if (typeof percentile === 'number') parts.push(`p${Math.round(percentile)}`)
      return {title: title ?? 'Untitled article', subtitle: parts.join(' · ')}
    },
  },
})
