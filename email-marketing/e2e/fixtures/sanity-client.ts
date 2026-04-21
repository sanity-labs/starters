import {createClient} from '@sanity/client'

export const sanityClient = createClient({
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  apiVersion: '2026-04-08',
  token: process.env.SANITY_E2E_SESSION_TOKEN,
  useCdn: false,
})
