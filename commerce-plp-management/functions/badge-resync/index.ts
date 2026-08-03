// Badge vocabulary re-sync.
//
// On the pull path, changing a productBadge label/color is live immediately via
// the GROQ `->` join. On the push path (Shopify metaobjects), the badge label is
// baked into each collection's metaobject at sync time, so a badge edit does not
// propagate until the referencing collections are re-synced.
//
// This function closes that gap: on publish of a productBadge, it re-upserts the
// metaobject for every collectionEnrichment that references the badge.
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {env} from 'node:process'
import {
  adminConfigFromEnv,
  createAdminClient,
  upsertCollectionMetaobject,
} from '@starter/commerce/shopify'
import type {CollectionEnrichment} from '@starter/commerce/types'

type EventData = {_id: string}

const AFFECTED_QUERY = defineQuery(`
  *[_type == "collectionEnrichment" && $badgeId in badges[].badge._ref]{
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
  }
`)

export const handler = documentEventHandler(async ({context, event}) => {
  const data = event.data as EventData
  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token
  const adminConfig = adminConfigFromEnv(env)

  if (!projectId || !dataset || !token) throw new Error('Missing Sanity client configuration')
  if (!adminConfig) throw new Error('Missing Shopify Admin credentials')

  const client = createClient({projectId, dataset, token, apiVersion: '2025-01-01', useCdn: false})
  const admin = createAdminClient(adminConfig)

  // The badge id may arrive as `badge-x` or `drafts.badge-x`; match the published ref.
  const badgeId = data._id.replace(/^drafts\./, '')
  const affected = (await client.fetch(AFFECTED_QUERY, {badgeId})) as CollectionEnrichment[]

  for (const enrichment of affected) {
    if (!enrichment.handle) continue
    await upsertCollectionMetaobject(admin, enrichment)
  }

  console.log(`Re-synced ${affected.length} collection(s) after badge ${badgeId} changed`)
})
