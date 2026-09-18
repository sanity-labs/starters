import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-03-01',
  useCdn: true,
  // The dataset is private, so even published reads need auth. This stays
  // server-only: the var is not NEXT_PUBLIC_, so it is undefined in the browser.
  token: process.env.SANITY_API_READ_TOKEN,
  requestTagPrefix: 'frontend.knowledge-base',
  stega: {
    studioUrl: process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/studio',
  },
})

export const token = process.env.SANITY_API_READ_TOKEN

export const serverClient = client.withConfig({
  token,
  useCdn: false,
  stega: false,
  perspective: 'published',
})
