/**
 * Shared commerce types.
 *
 * These describe two worlds that meet on the storefront:
 *  - Shopify* types: the canonical catalog (products, price, inventory, facets).
 *  - CollectionEnrichment*: the editorial layer authored in Sanity.
 *  - Merged*: the result of layering enrichment on top of the catalog.
 *
 * The package is intentionally framework-agnostic (no React, no Sanity client)
 * so the storefront and the push-sync Function can both import it.
 */

// ── Shopify (canonical catalog) ──────────────────────────────────────────────

export type Money = {
  amount: number
  currencyCode: string
}

export type ShopifyImage = {
  url: string
  altText: string | null
  width?: number
  height?: number
}

export type ShopifyProductVariant = {
  id: string
  title: string
  availableForSale: boolean
  price: Money
}

export type ShopifyProduct = {
  /** Global ID, e.g. `gid://shopify/Product/123`. The join key for enrichment. */
  id: string
  handle: string
  title: string
  featuredImage: ShopifyImage | null
  price: Money
  compareAtPrice: Money | null
  availableForSale: boolean
  productType: string | null
  variants: ShopifyProductVariant[]
}

export type ShopifyFacetValue = {
  handle: string
  label: string
  count: number
}

export type ShopifyFacet = {
  handle: string
  label: string
  values: ShopifyFacetValue[]
}

export type ShopifyCollection = {
  id: string
  handle: string
  title: string
  description: string | null
  products: ShopifyProduct[]
  facets: ShopifyFacet[]
}

// ── Enrichment (authored in Sanity) ──────────────────────────────────────────

export type CollectionType = 'shopify-native' | 'sanity-custom'

export type BadgeType = 'sale' | 'new' | 'final-sale' | 'best-seller' | 'custom'

export type SyncStatus = 'never' | 'pending' | 'synced' | 'failed'

/** Shared badge vocabulary document (`productBadge`). */
export type ProductBadge = {
  slug: string
  label: string
  /** Design token name, e.g. `sale`, `new`. Maps to a storefront color. */
  color: string
  icon?: string | null
}

export type BadgeAssignment = {
  productGid: string
  /** Resolved via GROQ `->` join, so label/color changes are live. */
  badge: ProductBadge | null
  /** Only used when the referenced badge is the `custom` type. */
  customLabel?: string | null
  startDate?: string | null
  endDate?: string | null
}

export type Banner = {
  imageUrl?: string | null
  headline?: string | null
  subhead?: string | null
  ctaLabel?: string | null
  ctaHref?: string | null
  theme?: string | null
}

export type Faceout = {
  productGid: string
  variantGid?: string | null
  editorialHeadline?: string | null
  imageUrlOverride?: string | null
}

export type EditorialTile = {
  /** 1-based grid slot the tile occupies. Product cards shift around it. */
  position: number
  imageUrl?: string | null
  headline?: string | null
  /** Portable Text blocks; rendered on the storefront. */
  body?: unknown[] | null
  ctaLabel?: string | null
  ctaHref?: string | null
  theme?: string | null
}

export type FacetConfig = {
  facetHandle: string
  labelOverride?: string | null
}

export type ProductListEntry = {
  productGid: string
  position: number
}

/**
 * Interim audience-targeted overrides, resolved at the storefront edge.
 * Migration target: Content Variants (do not persist past Content Variants GA).
 */
export type VariantOverride = {
  audienceTag: string
  banner?: Banner | null
  faceout?: Faceout | null
  editorialTiles?: EditorialTile[] | null
}

export type CollectionEnrichment = {
  handle: string
  collectionType: CollectionType
  title?: string | null
  banner?: Banner | null
  faceout?: Faceout | null
  editorialTiles?: EditorialTile[] | null
  badges?: BadgeAssignment[] | null
  facetConfig?: FacetConfig[] | null
  /** Active only when `collectionType === 'sanity-custom'`. */
  productList?: ProductListEntry[] | null
  pinnedRecs?: string[] | null
  variantOverrides?: VariantOverride[] | null
  syncStatus?: SyncStatus | null
}

// ── Merged (what the storefront renders) ─────────────────────────────────────

export type ResolvedBadge = {
  type: BadgeType
  label: string
  color: string
  icon?: string | null
}

export type GridProductItem = {
  kind: 'product'
  product: ShopifyProduct
  badges: ResolvedBadge[]
  isFaceout: boolean
  faceoutHeadline?: string | null
  faceoutImageUrl?: string | null
}

export type GridTileItem = {
  kind: 'tile'
  tile: EditorialTile
}

export type GridItem = GridProductItem | GridTileItem

export type MergedFacet = ShopifyFacet & {promoted: boolean}

export type MergedCollection = {
  handle: string
  title: string
  description: string | null
  collectionType: CollectionType
  /** False when no enrichment document exists (pure Shopify output). */
  enriched: boolean
  /** The audience tag that was resolved, if any. */
  audienceTag: string | null
  banner: Banner | null
  facets: MergedFacet[]
  grid: GridItem[]
}
