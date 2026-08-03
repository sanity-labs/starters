import {createStorefrontClient, type StorefrontClient} from '@starter/commerce/shopify'

let cached: StorefrontClient | null = null

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN &&
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
  )
}

/** Storefront client built from NEXT_PUBLIC_SHOPIFY_* env. Memoized per process. */
export function getStorefront(): StorefrontClient {
  if (cached) return cached
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
  if (!domain || !token) {
    throw new Error(
      'Shopify is not configured. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN in frontend/.env',
    )
  }
  cached = createStorefrontClient({
    domain,
    token,
    apiVersion: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_API_VERSION || '2025-07',
  })
  return cached
}
