export type AdminConfig = {
  domain: string
  apiVersion?: string
  /**
   * Static Admin API access token (`shpat_...`) from a legacy store-level custom
   * app. Optional — prefer clientId + clientSecret for Dev Dashboard apps.
   */
  token?: string
  /** Dev Dashboard app credentials. Exchanged for a short-lived access token. */
  clientId?: string
  clientSecret?: string
}

type GraphQLResponse<T> = {data?: T; errors?: {message: string}[]}
type TokenResponse = {access_token: string; expires_in: number; scope?: string}

/**
 * Minimal Shopify Admin API client. Used by the push-sync Function to write the
 * `sanity_plp_collection` metaobject. The Admin credentials are sensitive — this
 * client must only ever run server-side / inside a Function, never in the browser.
 *
 * Auth: Dev Dashboard apps have no static token in the UI. Instead we exchange
 * the Client ID + Client secret for a 24h access token via the client credentials
 * grant, caching and refreshing it automatically. A legacy static `token` is also
 * supported for store-level custom apps.
 * See https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
 */
export function createAdminClient(config: AdminConfig) {
  const apiVersion = config.apiVersion || '2025-07'
  const endpoint = `https://${config.domain}/admin/api/${apiVersion}/graphql.json`
  const tokenEndpoint = `https://${config.domain}/admin/oauth/access_token`

  let cachedToken: string | null = config.token ?? null
  // Static tokens never expire from our side; client-credentials tokens do.
  let expiresAt = config.token ? Number.POSITIVE_INFINITY : 0

  async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < expiresAt - 60_000) return cachedToken

    if (!config.clientId || !config.clientSecret) {
      throw new Error(
        'Shopify Admin auth requires either a static token or clientId + clientSecret',
      )
    }

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Shopify token request failed: ${res.status} ${res.statusText} ${body}`)
    }

    const json = (await res.json()) as TokenResponse
    cachedToken = json.access_token
    expiresAt = Date.now() + json.expires_in * 1000
    return cachedToken
  }

  async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const token = await getToken()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Shopify Admin API error: ${res.status} ${res.statusText} ${body}`)
    }
    const json = (await res.json()) as GraphQLResponse<T>
    if (json.errors?.length) {
      throw new Error(`Shopify Admin API: ${json.errors.map((e) => e.message).join('; ')}`)
    }
    return json.data as T
  }

  return {request}
}

export type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Build an AdminConfig from a plain env bag (process.env or a Function's env).
 * Prefers Dev Dashboard client credentials, falls back to a static token.
 */
export function adminConfigFromEnv(env: Record<string, string | undefined>): AdminConfig | null {
  const domain = env.SHOPIFY_STORE_DOMAIN
  if (!domain) return null

  const clientId = env.SHOPIFY_CLIENT_ID
  const clientSecret = env.SHOPIFY_CLIENT_SECRET
  const token = env.SHOPIFY_ADMIN_API_TOKEN

  if (!token && !(clientId && clientSecret)) return null

  return {
    domain,
    apiVersion: env.SHOPIFY_ADMIN_API_VERSION,
    token,
    clientId,
    clientSecret,
  }
}
