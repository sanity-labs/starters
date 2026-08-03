import {resolveBadgeMap} from './badges'
import {resolveEnrichmentForAudience} from './variants'
import type {
  CollectionEnrichment,
  EditorialTile,
  GridItem,
  GridProductItem,
  MergedCollection,
  MergedFacet,
  ShopifyCollection,
  ShopifyProduct,
} from './types'

export type MergeInput = {
  /** Canonical catalog. For sanity-custom collections this only supplies the
   * product records (fetched by GID batch); membership/order come from Sanity. */
  shopify: ShopifyCollection
  /** null => no enrichment document => pure Shopify output. */
  enrichment: CollectionEnrichment | null
  /** Visitor audience segment resolved at the edge (interim personalization). */
  audienceTag?: string | null
  /** Injected for deterministic badge date-gating (tests, SSR). */
  now?: Date
}

/**
 * Layer a Sanity enrichment document over Shopify catalog output.
 *
 * Presence-based: if `enrichment` is null the function returns the Shopify grid
 * untouched (enriched: false). This is the null-check the PRD calls for — a
 * collection with no Sanity document renders exactly like plain Shopify.
 */
export function mergeCollection(input: MergeInput): MergedCollection {
  const {shopify, enrichment, audienceTag, now = new Date()} = input

  if (!enrichment) {
    return {
      handle: shopify.handle,
      title: shopify.title,
      description: shopify.description,
      collectionType: 'shopify-native',
      enriched: false,
      audienceTag: null,
      banner: null,
      facets: shopify.facets.map((f) => ({...f, promoted: false})),
      grid: shopify.products.map((p) => toProductItem(p)),
    }
  }

  const view = resolveEnrichmentForAudience(enrichment, audienceTag)
  const badgeMap = resolveBadgeMap(enrichment.badges, now)

  const orderedProducts = orderProducts(shopify.products, enrichment)
  const faceoutGid = view.faceout?.productGid ?? null

  // Faceout renders at grid position 0; remove it from its natural slot.
  const withoutFaceout = faceoutGid
    ? orderedProducts.filter((p) => p.id !== faceoutGid)
    : orderedProducts

  const productItems: GridProductItem[] = []

  if (faceoutGid) {
    const faceoutProduct = orderedProducts.find((p) => p.id === faceoutGid)
    if (faceoutProduct) {
      productItems.push({
        ...toProductItem(faceoutProduct, badgeMap.get(faceoutProduct.id)),
        isFaceout: true,
        faceoutHeadline: view.faceout?.editorialHeadline ?? null,
        faceoutImageUrl: view.faceout?.imageUrlOverride ?? null,
      })
    }
  }

  for (const product of withoutFaceout) {
    productItems.push(toProductItem(product, badgeMap.get(product.id)))
  }

  const grid = injectTiles(productItems, view.editorialTiles)

  return {
    handle: enrichment.handle,
    title: enrichment.title || shopify.title,
    description: shopify.description,
    collectionType: enrichment.collectionType,
    enriched: true,
    audienceTag: view.audienceTag,
    banner: view.banner,
    facets: mergeFacets(shopify, enrichment),
    grid,
  }
}

function toProductItem(
  product: ShopifyProduct,
  badges: GridProductItem['badges'] = [],
): GridProductItem {
  return {kind: 'product', product, badges, isFaceout: false}
}

/**
 * For sanity-custom collections Sanity is the authority for membership and
 * order: sort by the explicit `productList` positions. For shopify-native
 * collections keep Shopify's order (pinnedRecs is applied by rec slots, not grid).
 */
function orderProducts(
  products: ShopifyProduct[],
  enrichment: CollectionEnrichment,
): ShopifyProduct[] {
  if (enrichment.collectionType !== 'sanity-custom' || !enrichment.productList?.length) {
    return products
  }

  const byGid = new Map(products.map((p) => [p.id, p]))
  const ordered = [...enrichment.productList]
    .sort((a, b) => a.position - b.position)
    .map((entry) => byGid.get(entry.productGid))
    .filter((p): p is ShopifyProduct => Boolean(p))

  return ordered
}

/**
 * Inject editorial tiles at their 1-based grid positions. Tiles displace product
 * cards rather than replacing them; later tiles account for earlier insertions.
 */
function injectTiles(productItems: GridProductItem[], tiles: EditorialTile[]): GridItem[] {
  if (!tiles.length) return productItems

  const grid: GridItem[] = [...productItems]
  const sorted = [...tiles].sort((a, b) => a.position - b.position)

  for (const tile of sorted) {
    const index = Math.max(0, Math.min(tile.position - 1, grid.length))
    grid.splice(index, 0, {kind: 'tile', tile})
  }

  return grid
}

/**
 * Reorder facets so promoted ones (from facetConfig) come first, in the
 * configured order, with label overrides applied. Remaining Shopify facets
 * follow in their original order.
 */
function mergeFacets(shopify: ShopifyCollection, enrichment: CollectionEnrichment): MergedFacet[] {
  if (!enrichment.facetConfig?.length) {
    return shopify.facets.map((f) => ({...f, promoted: false}))
  }

  const byHandle = new Map(shopify.facets.map((f) => [f.handle, f]))
  const promoted: MergedFacet[] = []

  for (const config of enrichment.facetConfig) {
    const facet = byHandle.get(config.facetHandle)
    if (!facet) continue
    promoted.push({
      ...facet,
      label: config.labelOverride || facet.label,
      promoted: true,
    })
    byHandle.delete(config.facetHandle)
  }

  const remaining: MergedFacet[] = shopify.facets
    .filter((f) => byHandle.has(f.handle))
    .map((f) => ({...f, promoted: false}))

  return [...promoted, ...remaining]
}
