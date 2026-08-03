import {createClient} from 'next-sanity'

import {apiVersion, dataset, projectId, studioUrl} from './env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  stega: {
    studioUrl,
  },
})

export const token = process.env.SANITY_API_READ_TOKEN
