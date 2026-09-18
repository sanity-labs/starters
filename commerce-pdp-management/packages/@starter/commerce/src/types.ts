/**
 * Shared commerce types for the PDP (product detail page) enrichment layer.
 *
 * Two worlds meet on the storefront:
 *  - Shopify* types: the canonical catalog (product identity, price, inventory,
 *    variants, tags). Shopify stays authoritative for all of this.
 *  - AttributeRule / ControlPlane / SkuEnrichment / BrandVoice: the editorial
 *    layer authored in Sanity.
 *  - Resolved* / Merged*: the result of layering enrichment over the catalog.
 *
 * The package is intentionally framework-agnostic (no React, no Sanity client)
 * so the storefront and the Sanity Functions can both import it.
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

export type ShopifyProductOption = {
  name: string
  values: string[]
}

/** Card-level product shape (grids, related products). */
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

/**
 * Full product detail returned for a PDP. Adds the fields the resolver and the
 * page need beyond a card: `tags` (the rule-matching input), the base
 * description, the media gallery, and variant options.
 */
export type ShopifyProductDetail = ShopifyProduct & {
  /** Shopify product tags — the input the attribute-rule resolver matches on. */
  tags: string[]
  descriptionHtml: string | null
  images: ShopifyImage[]
  options: ShopifyProductOption[]
}

// ── Enrichment (authored in Sanity) ──────────────────────────────────────────

export type AttributeCategory = 'care' | 'fit' | 'lifestyle' | 'spec' | 'launch'

export type ReviewStatus = 'draft' | 'in-review' | 'approved'

/** Portable Text blocks; rendered on the storefront. */
export type PortableTextBlock = unknown

/**
 * `attributeRule` — reusable editorial content applied to many products via tag
 * matching. Authored once, resolved for every matching product.
 */
export type AttributeRule = {
  _id: string
  name: string
  category: AttributeCategory
  description?: PortableTextBlock[] | null
  iconUrl?: string | null
  /** All must be present on the product for the rule to match (inclusion). */
  tags: string[]
  /** Any match disqualifies the rule (exclusion). */
  excludedTags: string[]
  language?: string | null
  /** Display position within a product's resolved attribute set. */
  order: number
  aiGenerated?: boolean | null
  status: ReviewStatus
}

/**
 * A dereferenced priority list as GROQ returns it: a reference to a rule that
 * was deleted or never published resolves to `null` rather than being omitted.
 */
export type PriorityList = Array<AttributeRule | null>

export type ProductTypeScope = {
  productType: string
  /**
   * Rules overriding the global priority for this product type, dereferenced in
   * resolution order. May include rules that are not in the global list.
   */
  priorityList?: PriorityList | null
}

/**
 * `controlPlane` — singleton. The prioritized list of active attribute rules.
 * Rules earlier in the list win within a category ("first-match wins").
 */
export type ControlPlane = {
  /** Approved attribute rules, in resolution priority order. */
  priorityList?: PriorityList | null
  productTypeScopes?: ProductTypeScope[] | null
}

/**
 * `skuEnrichment` — SKU-specific, opt-in editorial for a hero product. Layered
 * on top of the rule-resolved content. Matched by Shopify product GID.
 */
export type SkuEnrichment = {
  productGid: string
  headline?: string | null
  editorialCopy?: PortableTextBlock[] | null
  lifestyleImages?: ShopifyImage[] | null
  launchBadge?: string | null
  status: 'draft' | 'approved'
}

export type ExamplePhrase = {
  do?: string | null
  dont?: string | null
}

/** `brandVoice` — singleton. Governs AI generation context. */
export type BrandVoice = {
  persona?: PortableTextBlock[] | null
  toneGuidance?: PortableTextBlock[] | null
  contextPrompt?: string | null
  examplePhrases?: ExamplePhrase[] | null
}

// ── Merged (what the storefront renders) ─────────────────────────────────────

/** A single attribute rule resolved for a product, ready to render. */
export type ResolvedAttribute = {
  ruleId: string
  category: AttributeCategory
  name: string
  description?: PortableTextBlock[] | null
  iconUrl?: string | null
  order: number
}

export type MergedProduct = {
  product: ShopifyProductDetail
  /** False when no rule matched and no SKU enrichment exists (pure Shopify). */
  enriched: boolean
  /** Editorial headline (SKU enrichment) — falls back to the Shopify title. */
  headline: string
  /** Rule-resolved attribute blocks, sorted by display order. */
  attributes: ResolvedAttribute[]
  /** SKU-specific launch/editorial copy, if any. */
  editorialCopy?: PortableTextBlock[] | null
  lifestyleImages: ShopifyImage[]
  launchBadge: string | null
}
