import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'

const KLAVIYO_BASE = 'https://a.klaviyo.com/api'
const KLAVIYO_REVISION = '2025-07-15'

type KlaviyoItem = {id: string; name: string; profileCount: number | null; isActive: boolean}

type KlaviyoListResponse = {
  data: Array<{id: string; attributes: {name: string; is_active?: boolean}}>
  links?: {next?: string}
}

type KlaviyoDetailResponse = {
  data: {attributes: {profile_count?: number}}
}

const headers = (apiKey: string) => ({
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  revision: KLAVIYO_REVISION,
  accept: 'application/vnd.api+json',
})

async function klaviyoFetch<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {headers: headers(apiKey)})
  if (!res.ok) throw new Error(`Klaviyo API error: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function fetchAllSegments(apiKey: string): Promise<KlaviyoItem[]> {
  // Step 1: list all segments (no profile_count available on list endpoint)
  const segments: Array<{id: string; name: string; isActive: boolean}> = []
  let url: string | undefined = `${KLAVIYO_BASE}/segments?fields[segment]=name,is_active`

  do {
    const body = await klaviyoFetch<KlaviyoListResponse>(url, apiKey)
    for (const item of body.data) {
      segments.push({
        id: item.id,
        name: item.attributes.name ?? 'Unnamed',
        isActive: item.attributes.is_active ?? true,
      })
    }
    url = body.links?.next
  } while (url)

  // Step 2: fetch profile_count per segment (rate limit: 1/s, 15/min)
  const items: KlaviyoItem[] = []
  for (const segment of segments) {
    const detail = await klaviyoFetch<KlaviyoDetailResponse>(
      `${KLAVIYO_BASE}/segments/${segment.id}?additional-fields[segment]=profile_count&fields[segment]=profile_count`,
      apiKey,
    )
    items.push({
      ...segment,
      profileCount: detail.data.attributes.profile_count ?? null,
    })
    // Respect the 1/s burst rate limit for profile_count requests
    await new Promise((r) => setTimeout(r, 1100))
  }

  return items
}

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})
  const docId = event.data._id

  await client.patch(docId).set({importState: 'importing'}).commit()

  try {
    const apiKey = process.env.KLAVIYO_API_KEY
    if (!apiKey)
      throw new Error('KLAVIYO_API_KEY not set. Run: sanity functions env add KLAVIYO_API_KEY')
    const segments = await fetchAllSegments(apiKey)

    const tx = client.transaction()

    for (const segment of segments) {
      const sanityId = `klaviyo-segment-${segment.id}`
      const synced = {
        _type: 'segment' as const,
        name: segment.name,
        externalId: segment.id,
        memberCount: segment.profileCount,
        isActive: segment.isActive,
      }
      tx.createIfNotExists({_id: sanityId, ...synced})
      tx.patch(sanityId, (p) => p.set(synced))
    }

    const EXISTING_SEGMENTS_QUERY = defineQuery(
      `*[_type == "segment" && defined(externalId) && isTest != true]{_id}`,
    )
    const existingSegments = await client.fetch(EXISTING_SEGMENTS_QUERY)

    const klaviyoSegmentIds = new Set(segments.map((s) => `klaviyo-segment-${s.id}`))
    const segmentsToDelete = existingSegments
      .map((s: {_id: string}) => s._id)
      .filter((id: string) => !klaviyoSegmentIds.has(id))

    for (const id of segmentsToDelete) {
      tx.delete(id)
    }

    tx.patch(docId, (p) =>
      p.set({
        importState: 'imported',
        importErrorMessage: '',
        lastImportedAt: new Date().toISOString(),
        segmentCount: segments.length,
      }),
    )

    await tx.commit()

    console.log(`[import-klaviyo] Imported ${segments.length} segments`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({importState: 'error', importErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[import-klaviyo] Failed: ${message}`)
  }
})
