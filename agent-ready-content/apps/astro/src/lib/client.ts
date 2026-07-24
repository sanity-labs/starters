import {createClient} from '@sanity/client'

/**
 * Same requestTagPrefix as the Next.js app, so all starter traffic
 * groups together in request logs. Per-request tags distinguish the
 * surface (md.article, llms.index, html.section, ...).
 */
export const client = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID,
  dataset: import.meta.env.SANITY_DATASET || 'production',
  apiVersion: '2026-01-01',
  useCdn: true,
  requestTagPrefix: 'agent-content',
})
