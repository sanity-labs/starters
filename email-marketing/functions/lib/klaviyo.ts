const KLAVIYO_BASE_URL = 'https://a.klaviyo.com/api'
const KLAVIYO_REVISION = '2025-07-15'

type KlaviyoRequestOptions = {
  method?: string
  body?: unknown
}

export async function klaviyoFetch(path: string, options: KlaviyoRequestOptions = {}) {
  const apiKey = process.env.KLAVIYO_API_KEY
  if (!apiKey) {
    throw new Error(
      'KLAVIYO_API_KEY environment variable is not set. Run: sanity functions env add KLAVIYO_API_KEY',
    )
  }

  const url = `${KLAVIYO_BASE_URL}${path}`
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      revision: KLAVIYO_REVISION,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    throw new Error(`Klaviyo rate limited. Try again in ${retryAfter ?? 'a few'} seconds.`)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    let detail = errorBody
    try {
      const parsed = JSON.parse(errorBody)
      detail = parsed.errors?.map((e: any) => e.detail).join('; ') ?? errorBody
    } catch {}
    throw new Error(`Klaviyo API error (${response.status}): ${detail}`)
  }

  if (response.status === 204) return null
  return response.json()
}
