import {defineLive} from 'next-sanity/live'

// Load the generated query-result augmentation so sanityFetch is fully typed.
import '@starter/sanity-types'
import {client, token} from '@/sanity/client'

export const {sanityFetch, SanityLive} = defineLive({
  client,
  serverToken: token,
  browserToken: token,
})
