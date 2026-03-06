import 'server-only'

import {createClient, type QueryParams} from 'next-sanity'

const serverClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-05-01',
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
})

export async function sanityFetch<T>(query: string, params?: QueryParams): Promise<T> {
  return serverClient.fetch<T>(query, params ?? {})
}
