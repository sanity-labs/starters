import {createDataAttribute} from 'next-sanity'

import type {Preview} from './live'

/**
 * Where every edit overlay points — the stega encoder and `editRegion` alike.
 * The trailing slash is stripped because `createEditUrl` throws on one, and a
 * deploy-time `SANITY_STUDIO_URL=https://x.sanity.studio/` is an easy paste.
 */
export const STUDIO_URL = (process.env.SANITY_STUDIO_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
)

/**
 * A `data-sanity` attribute that turns a whole region into one click target in
 * Presentation. Stega only reaches text the client encoded, so a container, a
 * link or an image has nothing to attach to — such a region has to name its
 * document and field itself.
 *
 * Outside draft mode this is `undefined`, so published HTML carries no editing
 * metadata. The encoder requires a `path`, which rules out a document-root
 * region: name the field the overlay should focus.
 */
export function editRegion(
  preview: Preview,
  doc: {_id: string; _type: string},
  path: string,
): string | undefined {
  if (!preview.stega) return undefined

  return createDataAttribute({
    baseUrl: STUDIO_URL,
    id: doc._id,
    type: doc._type,
    path,
  }).toString()
}
