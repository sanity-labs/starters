import {createClient} from 'next-sanity'

/**
 * requestTagPrefix makes every request from this starter identifiable
 * in your project's request logs. Combined with per-request tags
 * (md.article, llms.index, ...) you can measure agent traffic instead
 * of guessing at it.
 */
export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-01-01',
  useCdn: true,
  requestTagPrefix: 'agent-content',
})
