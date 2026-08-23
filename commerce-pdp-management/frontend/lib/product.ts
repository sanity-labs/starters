import {mergeProduct, type MergedProduct} from '@starter/commerce'
import type {ControlPlane, SkuEnrichment} from '@starter/commerce/types'
import {sanityFetch} from '@/sanity/live'
import {controlPlaneQuery, skuEnrichmentByGidQuery} from '@/sanity/queries'
import {getStorefront} from './shopify'

/**
 * Assemble the PDP: the pull-only resolver the PRD describes.
 *
 *  1. Fetch the Shopify product by handle (tags, price, variants, media).
 *  2. In parallel, fetch the control plane (rule priority) and any SKU-specific
 *     enrichment for this product's GID.
 *  3. Merge — tag-match the rules, layer SKU enrichment on top. If nothing
 *     matches, the result is pure Shopify output (`enriched: false`).
 *
 * Nothing is written back to Shopify; enrichment resolves at render time.
 */
export async function getMergedProduct(handle: string): Promise<MergedProduct | null> {
  const storefront = getStorefront()
  const shopify = await storefront.getProductByHandle(handle)
  if (!shopify) return null

  const [{data: controlPlane}, {data: skuEnrichment}] = await Promise.all([
    sanityFetch({query: controlPlaneQuery}),
    sanityFetch({query: skuEnrichmentByGidQuery, params: {gid: shopify.id}}),
  ])

  return mergeProduct({
    shopify,
    controlPlane: (controlPlane as ControlPlane | null) ?? null,
    skuEnrichment: (skuEnrichment as SkuEnrichment | null) ?? null,
  })
}
