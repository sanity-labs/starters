import {defineField, defineType} from 'sanity'
import {InfoOutlineIcon} from '@sanity/icons'

// Catalog-level summary singleton, refreshed by the sync. Gives Content Agent a
// cheap, single-document view of catalog health for triage queries without
// scanning every companion document (PRD Phase 2, `analyticsContext`).
export const analyticsContext = defineType({
  name: 'analyticsContext',
  title: 'Analytics context',
  type: 'document',
  icon: InfoOutlineIcon,
  readOnly: true,
  fields: [
    defineField({name: 'totalArticles', title: 'Total articles', type: 'number'}),
    defineField({name: 'trendingCount', title: 'Trending', type: 'number'}),
    defineField({name: 'staleCount', title: 'Stale', type: 'number'}),
    defineField({name: 'archiveCandidateCount', title: 'Archive candidates', type: 'number'}),
    defineField({name: 'provider', title: 'Analytics provider', type: 'string'}),
    defineField({name: 'lastSyncedAt', title: 'Last synced at', type: 'datetime'}),
  ],
  preview: {
    select: {trending: 'trendingCount', stale: 'staleCount', synced: 'lastSyncedAt'},
    prepare({trending, stale, synced}) {
      return {
        title: 'Catalog analytics summary',
        subtitle: `${trending ?? 0} trending · ${stale ?? 0} stale${synced ? ` · synced ${new Date(synced).toLocaleString()}` : ''}`,
      }
    },
  },
})
