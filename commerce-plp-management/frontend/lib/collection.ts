import {mergeCollection, type CollectionEnrichment, type MergedCollection} from '@starter/commerce'
import type {ShopifyCollection} from '@starter/commerce/types'
import {sanityFetch} from '@/sanity/live'
import {collectionEnrichmentQuery} from '@/sanity/queries'
import {getStorefront} from './shopify'

type RawEnrichment = {
  handle: string
  collectionType: 'shopify-native' | 'sanity-custom'
  title?: string | null
  banner?: CollectionEnrichment['banner']
  faceout?: CollectionEnrichment['faceout']
  editorialTiles?: CollectionEnrichment['editorialTiles']
  badges?: CollectionEnrichment['badges']
  facetConfig?: CollectionEnrichment['facetConfig']
  productList?: {productGid: string}[] | null
  variantOverrides?: CollectionEnrichment['variantOverrides']
  syncStatus?: CollectionEnrichment['syncStatus']
}

/** Array order is the curation order; derive explicit positions for the merge. */
function mapEnrichment(raw: RawEnrichment): CollectionEnrichment {
  return {
    ...raw,
    title: raw.title ?? undefined,
    productList: raw.productList?.map((entry, index) => ({
      productGid: entry.productGid,
      position: index,
    })),
  }
}

/**
 * Fetch a collection and merge the Sanity enrichment over the Shopify catalog.
 *
 * Runs the two systems in parallel semantics:
 *  - Sanity: the enrichment document (may be null → pure Shopify output).
 *  - Shopify: product data. For sanity-custom collections membership comes from
 *    Sanity (GID batch); otherwise Shopify owns membership by handle.
 */
export async function getMergedCollection(
  handle: string,
  audienceTag: string | null,
): Promise<MergedCollection | null> {
  const {data: rawEnrichment} = await sanityFetch({
    query: collectionEnrichmentQuery,
    params: {handle},
  })

  const enrichment = rawEnrichment ? mapEnrichment(rawEnrichment as RawEnrichment) : null
  const storefront = getStorefront()

  let shopify: ShopifyCollection | null

  if (enrichment?.collectionType === 'sanity-custom') {
    const gids = enrichment.productList?.map((p) => p.productGid).filter(Boolean) ?? []
    const products = await storefront.getProductsByIds(gids)
    shopify = {
      id: `sanity-custom:${handle}`,
      handle,
      title: enrichment.title || handle,
      description: null,
      products,
      facets: [],
    }
  } else {
    shopify = await storefront.getCollectionByHandle(handle)
  }

  if (!shopify) return null

  return mergeCollection({shopify, enrichment, audienceTag})
}
