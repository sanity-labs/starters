import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {ApiKeySession, SegmentsApi} from 'klaviyo-api'

type KlaviyoItem = {id: string; name: string}

function nextCursor(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).searchParams.get('page[cursor]') ?? undefined
  } catch {
    return undefined
  }
}

async function fetchAllSegments(segmentsApi: SegmentsApi): Promise<KlaviyoItem[]> {
  const items: KlaviyoItem[] = []
  let pageCursor: string | undefined

  do {
    const result = await segmentsApi.getSegments({fieldsSegment: ['name'], pageCursor})
    for (const item of result.body.data ?? []) {
      items.push({id: item.id, name: item.attributes?.name ?? 'Unnamed'})
    }
    pageCursor = nextCursor(result.body.links?.next)
  } while (pageCursor)

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
    const session = new ApiKeySession(apiKey)
    const segments = await fetchAllSegments(new SegmentsApi(session))

    const tx = client.transaction()

    for (const segment of segments) {
      const sanityId = `klaviyo-segment-${segment.id}`
      tx.createIfNotExists({
        _id: sanityId,
        _type: 'segment',
        name: segment.name,
        externalId: segment.id,
      })
      tx.patch(sanityId, (p) =>
        p.set({_type: 'segment', name: segment.name, externalId: segment.id}),
      )
    }

    const EXISTING_SEGMENTS_QUERY = defineQuery(`*[_type == "segment" && defined(externalId)]._id`)
    const existingSegments = await client.fetch(EXISTING_SEGMENTS_QUERY)

    const klaviyoSegmentIds = new Set(segments.map((s) => `klaviyo-segment-${s.id}`))
    const segmentsToDelete = existingSegments.filter((id: string) => !klaviyoSegmentIds.has(id))

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
