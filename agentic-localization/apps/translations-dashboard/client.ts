import {createClient} from '@sanity/client'

// Shared Sanity configuration
export const sanityConfig = {
  apiVersion: 'vX', // Required for agent actions (translate, etc.)
  dataset: import.meta.env.SANITY_APP_DATASET || 'production',
  projectId: import.meta.env.SANITY_APP_PROJECT_ID,
  useCdn: false,
}

// Client instance for non-React contexts (utility functions, etc.)
export const client = createClient(sanityConfig)
