// Document function: runs whenever a `klaviyoImport` document is updated to
// `importState == "requested"` (see the filter in sanity.blueprint.ts). It
// fetches segments from the Klaviyo API, mirrors them into Sanity as `segment`
// documents, and updates the import status as it goes.
//
// Two ways this gets triggered:
//   1. The user clicks "Import from Klaviyo" in the Studio (see
//      ImportFromKlaviyoAction).
//   2. The scheduled-import-klaviyo function flips the same flag on a cron.
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'

// Klaviyo's API base URL and the API revision we pin against. Bumping the
// revision is a deliberate choice — Klaviyo treats it as a versioned contract.
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

// Fetches every segment from Klaviyo, then enriches each one with its
// profile_count. Done in two steps because Klaviyo's list endpoint doesn't
// return profile_count — you have to ask for it per segment.
async function fetchAllSegments(apiKey: string): Promise<KlaviyoItem[]> {
  // Step 1: page through every segment.
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
    // Klaviyo returns links.next as a fully-qualified URL when there's more.
    url = body.links?.next
  } while (url)

  // Step 2: fetch profile_count per segment. Klaviyo rate-limits this endpoint
  // to ~1 request/second, so we sleep 1.1s between calls to stay under it.
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
    await new Promise((r) => setTimeout(r, 1100))
  }

  return items
}

export const handler = documentEventHandler(async ({context, event}) => {
  // Document functions get projectId, dataset, and a token pre-wired on
  // context.clientOptions, so we just spread it into createClient.
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})
  const docId = event.data._id

  // Mark the import as in-progress so the Studio UI can show a spinner and so
  // the scheduled function knows to skip if it fires while we're working.
  await client.patch(docId).set({importState: 'importing'}).commit()

  try {
    // The Klaviyo API key is set as a function runtime env var via
    // `sanity functions env add KLAVIYO_API_KEY <key>` — not in .env.
    const apiKey = process.env.KLAVIYO_API_KEY
    if (!apiKey)
      throw new Error('KLAVIYO_API_KEY not set. Run: sanity functions env add KLAVIYO_API_KEY')
    const segments = await fetchAllSegments(apiKey)

    // Batch every Sanity write into a single transaction. If anything fails
    // it's all-or-nothing, and it's much faster than awaiting each patch.
    const tx = client.transaction()

    // Upsert each Klaviyo segment as a Sanity `segment` document. We use a
    // deterministic `klaviyo-segment-${id}` so re-runs update the same doc.
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

    // Find segments that exist in Sanity but no longer in Klaviyo, so we can
    // remove them. `isTest != true` keeps locally-seeded test data safe.
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

    // Mark the import as done and stamp the timestamp the Studio displays.
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
    // On failure, surface the message back to the Studio via importState so
    // the editor can see what went wrong without digging through logs.
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({importState: 'error', importErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[import-klaviyo] Failed: ${message}`)
  }
})
