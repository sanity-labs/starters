import {cookies} from 'next/headers'

export const AUDIENCE_COOKIE = 'swag_audience'

/**
 * Resolve the visitor's audience segment at the edge from a first-party cookie.
 *
 * INTERIM: this is the storefront-side resolution for the ahead-of-product
 * variantOverrides pattern. When Content Variants ships, the API resolves the
 * correct variant and this cookie lookup goes away.
 */
export async function getAudienceTag(): Promise<string | null> {
  const store = await cookies()
  return store.get(AUDIENCE_COOKIE)?.value ?? null
}
