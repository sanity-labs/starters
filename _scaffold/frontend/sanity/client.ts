import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-03-01',
  useCdn: true,
  stega: {
    studioUrl: process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/studio',
  },
})

export const token = process.env.SANITY_API_READ_TOKEN
