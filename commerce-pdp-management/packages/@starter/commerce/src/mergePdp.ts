import {resolveAttributeRules} from './resolvePdp'
import type {ControlPlane, MergedProduct, ShopifyProductDetail, SkuEnrichment} from './types'

export type MergeInput = {
  /** Canonical product data from Shopify. */
  shopify: ShopifyProductDetail
  /** Control plane singleton (rule priority), or null. */
  controlPlane: ControlPlane | null
  /** SKU-specific enrichment for this product, or null. Only approved is passed. */
  skuEnrichment: SkuEnrichment | null
}

/**
 * Layer the Sanity editorial content over the Shopify product.
 *
 * Presence-based, exactly as the PRD requires: if no attribute rule matches and
 * no SKU enrichment exists, the function returns the Shopify product untouched
 * (`enriched: false`) — the PDP renders as pure Shopify. Otherwise the resolved
 * attribute blocks and the SKU enrichment are layered on top; Shopify stays
 * authoritative for identity, price, inventory, variants, and base media.
 */
export function mergeProduct(input: MergeInput): MergedProduct {
  const {shopify, controlPlane, skuEnrichment} = input

  const attributes = resolveAttributeRules({
    productTags: shopify.tags,
    productType: shopify.productType,
    controlPlane,
  })

  const sku = skuEnrichment?.status === 'approved' ? skuEnrichment : null
  const enriched = attributes.length > 0 || sku !== null

  return {
    product: shopify,
    enriched,
    headline: sku?.headline || shopify.title,
    attributes,
    editorialCopy: sku?.editorialCopy ?? null,
    lifestyleImages: sku?.lifestyleImages ?? [],
    launchBadge: sku?.launchBadge ?? null,
  }
}
