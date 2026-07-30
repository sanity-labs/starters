import type {ShopifyImage, ShopifyProduct, ShopifyProductDetail} from '../types'

export type StorefrontConfig = {
  domain: string
  token: string
  apiVersion?: string
  /**
   * Extra fetch options merged into every request. In a Next.js app pass caching
   * hints here, e.g. `{next: {revalidate: 300, tags: ['shopify']}}`, so repeated
   * renders (including Sanity live refreshes) are served from the data cache
   * instead of re-hitting Shopify.
   */
  fetchOptions?: RequestInit
  /**
   * Retries for transient failures before throwing. Shopify development stores
   * return `402 Payment Required` for a moment while waking from idle, and the API
   * returns `429`/`5xx` under load — all transient. Defaults to 2.
   */
  maxRetries?: number
}

type GraphQLResponse<T> = {data?: T; errors?: {message: string}[]}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Transient HTTP statuses worth retrying: dev-store wake-up, rate limit, server. */
function isTransient(status: number): boolean {
  return status === 402 || status === 429 || status >= 500
}

const PRODUCT_CARD_FRAGMENT = /* GraphQL */ `
  fragment ProductCard on Product {
    id
    handle
    title
    productType
    availableForSale
    featuredImage {
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 20) {
      nodes {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
        }
      }
    }
  }
`

const PRODUCT_DETAIL_FRAGMENT = /* GraphQL */ `
  fragment ProductDetail on Product {
    ...ProductCard
    tags
    descriptionHtml
    images(first: 12) {
      nodes {
        url
        altText
        width
        height
      }
    }
    options {
      name
      values
    }
  }
`

/**
 * Minimal Shopify Storefront API client used by the storefront (product detail,
 * price, inventory, related products) and the Studio product picker (search).
 * Uses the public Storefront token — safe to expose to the browser.
 */
export function createStorefrontClient(config: StorefrontConfig) {
  const apiVersion = config.apiVersion || '2025-07'
  const endpoint = `https://${config.domain}/api/${apiVersion}/graphql.json`

  const maxRetries = config.maxRetries ?? 2

  async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({query, variables})
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let res: Response
      try {
        res = await fetch(endpoint, {
          ...config.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': config.token,
            ...(config.fetchOptions?.headers as Record<string, string> | undefined),
          },
          body,
        })
      } catch (err) {
        // Network error — retry with backoff before giving up.
        lastError = err
        if (attempt < maxRetries) {
          await delay(500 * (attempt + 1))
          continue
        }
        throw err
      }

      if (!res.ok) {
        if (isTransient(res.status) && attempt < maxRetries) {
          await delay(500 * (attempt + 1))
          continue
        }
        throw new Error(`Shopify Storefront API error: ${res.status} ${res.statusText}`)
      }

      const json = (await res.json()) as GraphQLResponse<T>
      if (json.errors?.length) {
        throw new Error(`Shopify Storefront API: ${json.errors.map((e) => e.message).join('; ')}`)
      }
      return json.data as T
    }

    throw lastError ?? new Error('Shopify Storefront API request failed')
  }

  return {
    request,

    /** Fetch a single product with full detail (tags, media, options). Null if missing. */
    async getProductByHandle(handle: string): Promise<ShopifyProductDetail | null> {
      const query = /* GraphQL */ `
        ${PRODUCT_CARD_FRAGMENT}
        ${PRODUCT_DETAIL_FRAGMENT}
        query ProductByHandle($handle: String!) {
          product(handle: $handle) {
            ...ProductDetail
          }
        }
      `
      const data = await request<{product: RawProductDetail | null}>(query, {handle})
      if (!data.product) return null
      return normalizeProductDetail(data.product)
    },

    /** Related products for the "You may also like" rail. */
    async getProductRecommendations(productId: string): Promise<ShopifyProduct[]> {
      const query = /* GraphQL */ `
        ${PRODUCT_CARD_FRAGMENT}
        query ProductRecommendations($productId: ID!) {
          productRecommendations(productId: $productId) {
            ...ProductCard
          }
        }
      `
      const data = await request<{productRecommendations: RawProduct[] | null}>(query, {productId})
      return (data.productRecommendations ?? []).map(normalizeProduct)
    },

    /** List catalog products, for the storefront landing page and route generation. */
    async listProducts(first = 24): Promise<ShopifyProduct[]> {
      const query = /* GraphQL */ `
        ${PRODUCT_CARD_FRAGMENT}
        query ListProducts($first: Int!) {
          products(first: $first, sortKey: BEST_SELLING) {
            nodes {
              ...ProductCard
            }
          }
        }
      `
      const data = await request<{products: {nodes: RawProduct[]}}>(query, {first})
      return data.products.nodes.map(normalizeProduct)
    },

    /** Search the catalog by name. Powers the Studio product picker. */
    async searchProducts(term: string, first = 10): Promise<ShopifyProduct[]> {
      const query = /* GraphQL */ `
        ${PRODUCT_CARD_FRAGMENT}
        query SearchProducts($query: String!, $first: Int!) {
          products(first: $first, query: $query) {
            nodes {
              ...ProductCard
            }
          }
        }
      `
      const data = await request<{products: {nodes: RawProduct[]}}>(query, {
        query: term ? `title:*${term}*` : '',
        first,
      })
      return data.products.nodes.map(normalizeProduct)
    },
  }
}

export type StorefrontClient = ReturnType<typeof createStorefrontClient>

// ── Normalization (Storefront GraphQL shape -> our flat types) ────────────────

type RawMoney = {amount: string; currencyCode: string}
type RawImage = {url: string; altText: string | null; width?: number; height?: number}
type RawProduct = {
  id: string
  handle: string
  title: string
  productType: string | null
  availableForSale: boolean
  featuredImage: RawImage | null
  priceRange: {minVariantPrice: RawMoney}
  compareAtPriceRange: {minVariantPrice: RawMoney}
  variants: {nodes: {id: string; title: string; availableForSale: boolean; price: RawMoney}[]}
}
type RawProductDetail = RawProduct & {
  tags: string[]
  descriptionHtml: string | null
  images: {nodes: RawImage[]}
  options: {name: string; values: string[]}[]
}

function money(raw: RawMoney): Money {
  return {amount: Number.parseFloat(raw.amount), currencyCode: raw.currencyCode}
}

type Money = {amount: number; currencyCode: string}

function image(raw: RawImage): ShopifyImage {
  return {url: raw.url, altText: raw.altText, width: raw.width, height: raw.height}
}

function normalizeProduct(raw: RawProduct): ShopifyProduct {
  const compareAt = money(raw.compareAtPriceRange.minVariantPrice)
  const price = money(raw.priceRange.minVariantPrice)
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    productType: raw.productType,
    availableForSale: raw.availableForSale,
    featuredImage: raw.featuredImage ? image(raw.featuredImage) : null,
    price,
    compareAtPrice: compareAt.amount > price.amount ? compareAt : null,
    variants: raw.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      availableForSale: v.availableForSale,
      price: money(v.price),
    })),
  }
}

function normalizeProductDetail(raw: RawProductDetail): ShopifyProductDetail {
  return {
    ...normalizeProduct(raw),
    tags: raw.tags ?? [],
    descriptionHtml: raw.descriptionHtml,
    images: (raw.images?.nodes ?? []).map(image),
    options: (raw.options ?? []).map((o) => ({name: o.name, values: o.values})),
  }
}
