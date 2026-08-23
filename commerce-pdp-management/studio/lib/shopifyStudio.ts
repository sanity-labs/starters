/**
 * Small Storefront API helpers used inside Studio (browser) for async
 * validation. Uses the public Storefront token from studio/.env.
 */

const DOMAIN = process.env.SANITY_STUDIO_SHOPIFY_STORE_DOMAIN
const TOKEN = process.env.SANITY_STUDIO_SHOPIFY_STOREFRONT_TOKEN
const API_VERSION = process.env.SANITY_STUDIO_SHOPIFY_STOREFRONT_API_VERSION || '2025-07'

export const shopifyConfigured = Boolean(DOMAIN && TOKEN)

/**
 * Given product GIDs, return the subset that are NOT active/available in Shopify.
 * Products deleted in Shopify silently break SKU enrichments, so this powers a
 * warning-level validation rule on the product picker.
 */
export async function findInactiveGids(gids: string[]): Promise<string[]> {
  if (!shopifyConfigured || gids.length === 0) return []

  const query = /* GraphQL */ `
    query CheckNodes($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
        }
      }
    }
  `
  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN as string,
    },
    body: JSON.stringify({query, variables: {ids: gids}}),
  })
  if (!res.ok) return []

  const json = await res.json()
  const nodes: ({id: string} | null)[] = json?.data?.nodes ?? []
  const found = new Set(nodes.filter(Boolean).map((n) => (n as {id: string}).id))
  return gids.filter((gid) => !found.has(gid))
}
