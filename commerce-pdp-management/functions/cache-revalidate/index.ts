// CDN cache invalidation (pull-only).
//
// On publish of a controlPlane, attributeRule, or skuEnrichment document, ping
// the storefront's on-demand revalidation endpoint so cached PDPs pick up the new
// enrichment. This is the PRD's "cache invalidation on control plane publish" —
// no data is pushed to Shopify; the storefront simply re-pulls from Sanity's CDN.
import {documentEventHandler} from '@sanity/functions'
import {env} from 'node:process'

export const handler = documentEventHandler(async ({event}) => {
  const url = env.STOREFRONT_REVALIDATE_URL
  const secret = env.SANITY_REVALIDATE_SECRET

  if (!url || !secret) {
    console.warn(
      'Skipping revalidation: STOREFRONT_REVALIDATE_URL or SANITY_REVALIDATE_SECRET unset',
    )
    return
  }

  const type = (event.data as {_type?: string})?._type ?? 'document'

  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-revalidate-secret': secret},
    // A control-plane / rule change affects many products, so we trigger a broad
    // revalidation rather than a single handle.
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    throw new Error(`Revalidation request failed: ${res.status} ${res.statusText}`)
  }

  console.log(`Revalidated storefront after ${type} publish`)
})
