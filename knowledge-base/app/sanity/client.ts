import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-03-01',
  useCdn: true,
  requestTagPrefix: 'frontend.knowledge-base',
  stega: {
    studioUrl: process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/studio',
  },
})

export const token = process.env.SANITY_READ_TOKEN_EXTERNAL

// Server-only client for authenticated reads against the private dataset
// (e.g. search). The token never reaches the browser.
export const serverClient = client.withConfig({
  token,
  useCdn: false,
  stega: false,
  perspective: 'published',
})
