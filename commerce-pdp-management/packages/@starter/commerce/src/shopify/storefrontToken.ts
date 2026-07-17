import type {AdminClient} from './admin'

/**
 * Mint a public Storefront API access token via the Admin API. Dev Dashboard apps
 * don't expose a static Storefront token in the UI, so we create one from the
 * Admin credentials (which we already exchange via client credentials). The
 * resulting token is public and safe to use in the Studio product picker and the
 * storefront runtime.
 *
 * Requires the app to have Storefront API access (e.g. the
 * `unauthenticated_read_product_listings` scope).
 */
export async function createStorefrontAccessToken(
  admin: AdminClient,
  title = 'Sanity PDP Storefront',
): Promise<string> {
  const query = /* GraphQL */ `
    mutation CreateStorefrontToken($input: StorefrontAccessTokenInput!) {
      storefrontAccessTokenCreate(input: $input) {
        storefrontAccessToken {
          accessToken
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `
  const data = await admin.request<{
    storefrontAccessTokenCreate: {
      storefrontAccessToken: {accessToken: string; title: string} | null
      userErrors: {field: string[]; message: string}[]
    }
  }>(query, {input: {title}})

  const {storefrontAccessToken, userErrors} = data.storefrontAccessTokenCreate
  if (userErrors.length || !storefrontAccessToken) {
    throw new Error(
      `Failed to create Storefront access token: ${userErrors.map((e) => e.message).join('; ')}`,
    )
  }
  return storefrontAccessToken.accessToken
}
