import {createClient} from '@sanity/client'
import {getUserToken} from './authToken'

export function getClient() {
  return createClient({
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET!,
    apiVersion: 'vX',
    token: getUserToken(),
    useCdn: false,
  })
}
