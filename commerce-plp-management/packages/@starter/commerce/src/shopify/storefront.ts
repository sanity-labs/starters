import type {ShopifyCollection, ShopifyProduct} from '../types'

export type StorefrontConfig = {
  domain: string
  token: string
  apiVersion?: string
}

type GraphQLResponse<T> = {data?: T; errors?: {message: string}[]}

const PRODUCT_FRAGMENT = /* GraphQL */ `
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

/**
 * Minimal Shopify Storefront API client used by the storefront (products, price,
 * inventory, collection membership) and the Studio product picker (search).
 * Uses the public Storefront token — safe to expose to the browser.
 */
export function createStorefrontClient(config: StorefrontConfig) {
  const apiVersion = config.apiVersion || '2025-07'
  const endpoint = `https://${config.domain}/api/${apiVersion}/graphql.json`

  async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.token,
      },
      body: JSON.stringify({query, variables}),
    })
    if (!res.ok) {
      throw new Error(`Shopify Storefront API error: ${res.status} ${res.statusText}`)
    }
    const json = (await res.json()) as GraphQLResponse<T>
    if (json.errors?.length) {
      throw new Error(`Shopify Storefront API: ${json.errors.map((e) => e.message).join('; ')}`)
    }
    return json.data as T
  }

  return {
    request,

    /** Fetch a native collection with its products. Returns null if not found. */
    async getCollectionByHandle(
      handle: string,
      options: {first?: number} = {},
    ): Promise<ShopifyCollection | null> {
      const query = /* GraphQL */ `
        ${PRODUCT_FRAGMENT}
        query CollectionByHandle($handle: String!, $first: Int!) {
          collection(handle: $handle) {
            id
            handle
            title
            description
            products(first: $first) {
              nodes {
                ...ProductCard
              }
              filters {
                id
                label
                values {
                  id
                  label
                  count
                }
              }
            }
          }
        }
      `
      const data = await request<{collection: RawCollection | null}>(query, {
        handle,
        first: options.first ?? 48,
      })
      if (!data.collection) return null
      return normalizeCollection(data.collection)
    },

    /** Batch-fetch products by GID (for sanity-custom collection membership). */
    async getProductsByIds(ids: string[]): Promise<ShopifyProduct[]> {
      if (!ids.length) return []
      const query = /* GraphQL */ `
        ${PRODUCT_FRAGMENT}
        query ProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              ...ProductCard
            }
          }
        }
      `
      const data = await request<{nodes: (RawProduct | null)[]}>(query, {ids})
      return data.nodes.filter((n): n is RawProduct => Boolean(n)).map(normalizeProduct)
    },

    /** Search the catalog by name. Powers the Studio product picker. */
    async searchProducts(term: string, first = 10): Promise<ShopifyProduct[]> {
      const query = /* GraphQL */ `
        ${PRODUCT_FRAGMENT}
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
type RawProduct = {
  id: string
  handle: string
  title: string
  productType: string | null
  availableForSale: boolean
  featuredImage: {url: string; altText: string | null; width?: number; height?: number} | null
  priceRange: {minVariantPrice: RawMoney}
  compareAtPriceRange: {minVariantPrice: RawMoney}
  variants: {nodes: {id: string; title: string; availableForSale: boolean; price: RawMoney}[]}
}
type RawCollection = {
  id: string
  handle: string
  title: string
  description: string | null
  products: {
    nodes: RawProduct[]
    filters: {id: string; label: string; values: {id: string; label: string; count: number}[]}[]
  }
}

function money(raw: RawMoney): {amount: number; currencyCode: string} {
  return {amount: Number.parseFloat(raw.amount), currencyCode: raw.currencyCode}
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
    featuredImage: raw.featuredImage,
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

function normalizeCollection(raw: RawCollection): ShopifyCollection {
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    products: raw.products.nodes.map(normalizeProduct),
    facets: raw.products.filters.map((f) => ({
      handle: f.id,
      label: f.label,
      values: f.values.map((v) => ({handle: v.id, label: v.label, count: v.count})),
    })),
  }
}
