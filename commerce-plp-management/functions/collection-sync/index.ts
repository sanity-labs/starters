// Push-sync: Sanity -> Shopify.
//
// On publish of a collectionEnrichment document, write the whole enrichment
// payload to a single `sanity_plp_collection` metaobject in Shopify (per the
// PRD decision: one metaobject per collection, not per-product metafields), then
// stamp syncStatus on the Sanity document (green / red) so the merchandiser sees
// the result without leaving Studio.
//
// The Sanity CDN pull path is unaffected by push failures — the storefront still
// serves the enrichment correctly even if this metaobject write fails.
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {env} from 'node:process'
import {
  adminConfigFromEnv,
  createAdminClient,
  ensureMetaobjectDefinition,
  upsertCollectionMetaobject,
} from '@starter/commerce/shopify'
import type {CollectionEnrichment} from '@starter/commerce/types'

type EventData = {_id: string; handle?: {current?: string}}

const ENRICHMENT_QUERY = defineQuery(`*[_id == $id][0]{
  "handle": handle.current,
  collectionType,
  title,
  banner{"imageUrl": image.asset->url, headline, subhead, ctaLabel, ctaHref, theme},
  faceout{
    "productGid": product.productGid,
    variantGid,
    editorialHeadline,
    "imageUrlOverride": imageOverride.asset->url
  },
  editorialTiles[]{position, "imageUrl": image.asset->url, headline, body, ctaLabel, ctaHref, theme},
  badges[]{
    "productGid": product.productGid,
    "badge": badge->{"slug": slug.current, label, color, icon},
    customLabel, startDate, endDate
  },
  facetConfig[]{facetHandle, labelOverride},
  productList[]{"productGid": productGid}
}`)

export const handler = documentEventHandler(async ({context, event}) => {
  const data = event.data as EventData
  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token

  if (!projectId || !dataset || !token) {
    throw new Error('Missing Sanity client configuration')
  }

  const client = createClient({projectId, dataset, token, apiVersion: '2025-01-01', useCdn: false})

  // Mark pending while we push.
  await client
    .patch(data._id)
    .set({syncStatus: {status: 'pending'}})
    .commit()

  try {
    const adminConfig = adminConfigFromEnv(env)
    if (!adminConfig) {
      throw new Error(
        'Missing Shopify Admin credentials (SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET)',
      )
    }

    const enrichment = (await client.fetch(ENRICHMENT_QUERY, {
      id: data._id,
    })) as CollectionEnrichment | null
    if (!enrichment?.handle) {
      throw new Error('Enrichment document has no handle')
    }

    const admin = createAdminClient(adminConfig)

    await ensureMetaobjectDefinition(admin)
    await upsertCollectionMetaobject(admin, enrichment)

    await client
      .patch(data._id)
      .set({syncStatus: {status: 'synced', lastSyncedAt: new Date().toISOString()}})
      .commit()

    console.log(`Synced collection "${enrichment.handle}" to Shopify metaobject`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(data._id)
      .set({syncStatus: {status: 'failed', error: message, lastSyncedAt: new Date().toISOString()}})
      .commit()
    throw error
  }
})
