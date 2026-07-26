import 'server-only'

import {cookies, draftMode} from 'next/headers'
import {createClient} from 'next-sanity'
import {
  defineLive,
  resolvePerspectiveFromCookies,
  resolveVariantFromCookies,
  type LivePerspective,
} from 'next-sanity/live'

import {stegaFilter} from './stega'
import {STUDIO_URL} from './studio'

const readToken = process.env.SANITY_API_READ_TOKEN

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-05-01',
  useCdn: true,
  perspective: 'published',
  requestTagPrefix: 'frontend.agentic-l10n',
  // `defineLive` withholds `serverToken` from published fetches, which assumes
  // a public dataset. The blueprint provisions a private one, so the token has
  // to sit on the client. This module is `server-only`, and `defineLive` reads
  // no token off the client when it configures the browser connection.
  token: readToken,
  // Where the edit overlays point. `defineLive` turns encoding off on the
  // client and back on per fetch, which keeps both of these and flips
  // `enabled`.
  stega: {
    studioUrl: STUDIO_URL,
    filter: stegaFilter,
  },
})

/**
 * `strict: true` makes `perspective` and `stega` required on every fetch and
 * `includeDrafts` required on `<SanityLive />`. Under Cache Components that is
 * the point: `draftMode()` and `cookies()` cannot be read inside a `'use cache'`
 * boundary, so the choice has to be made outside it and passed in.
 */
export const {sanityFetch, SanityLive} = defineLive({
  client,
  serverToken: readToken,
  // Reaches the browser only when `<SanityLive includeDrafts />` renders, which
  // only happens in draft mode. Without it the live connection is published
  // only and a Studio edit never reaches the preview: Presentation reports the
  // mutation and `<VisualEditing />` declines to refresh on that source.
  browserToken: readToken,
  strict: true,
})

/** Which content a render reads, and whether it carries edit overlays. */
export interface Preview {
  perspective: LivePerspective
  variant?: string
  stega: boolean
}

/** What a visitor sees — and what prerenders, since draft mode is off there. */
export const PUBLISHED: Preview = {perspective: 'published', stega: false}

/**
 * `draftMode()` and `cookies()` are request data, so this resolves outside every
 * `'use cache'` boundary and its result is passed in as an argument — which
 * also keys the cache, so a draft render never lands in the published entry.
 */
export async function resolvePreview(): Promise<Preview> {
  const {isEnabled} = await draftMode()
  if (!isEnabled) return PUBLISHED

  const jar = await cookies()

  return {
    perspective: await resolvePerspectiveFromCookies({cookies: jar}),
    variant: await resolveVariantFromCookies({cookies: jar}),
    stega: true,
  }
}
