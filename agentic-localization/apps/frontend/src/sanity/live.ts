import 'server-only'

import {createClient} from 'next-sanity'
import {defineLive} from 'next-sanity/live'

const readToken = process.env.SANITY_API_READ_TOKEN

const client = createClient({
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
  // No browser token: drafts are previewed through the Studio's Presentation
  // tool, which supplies its own. See the TODO in `app/[lang]/layout.tsx`.
  browserToken: false,
  strict: true,
})
