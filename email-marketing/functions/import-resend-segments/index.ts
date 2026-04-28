import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {Resend} from 'resend'

type SyncedSegment = {
  id: string
  name: string
  memberCount: number
  isActive: boolean
}

async function fetchAllSegments(resend: Resend): Promise<SyncedSegment[]> {
  const {data, error} = await resend.segments.list()
  if (error) throw new Error(`Resend segments.list failed: ${error.message}`)

  const segments = data?.data ?? []

  // Resend Segments are static lists. memberCount is derived by listing contacts.
  const items: SyncedSegment[] = []
  for (const segment of segments) {
    const {data: contactsData, error: contactsError} = await resend.contacts.list({
      segmentId: segment.id,
    })
    if (contactsError) {
      throw new Error(
        `Resend contacts.list failed for segment ${segment.id}: ${contactsError.message}`,
      )
    }
    const contacts = contactsData?.data ?? []
    items.push({
      id: segment.id,
      name: segment.name ?? 'Unnamed',
      memberCount: contacts.length,
      isActive: true,
    })
  }

  return items
}

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})
  const docId = event.data._id

  await client.patch(docId).set({importState: 'importing'}).commit()

  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey)
      throw new Error('RESEND_API_KEY not set. Run: sanity functions env add RESEND_API_KEY')

    const resend = new Resend(apiKey)
    const segments = await fetchAllSegments(resend)

    const tx = client.transaction()

    for (const segment of segments) {
      const sanityId = `resend-segment-${segment.id}`
      const synced = {
        _type: 'segment' as const,
        name: segment.name,
        externalId: segment.id,
        memberCount: segment.memberCount,
        isActive: segment.isActive,
      }
      // createIfNotExists + partial patch preserves editorial enrichment fields
      // (affinityDescription, etc.) on existing docs.
      tx.createIfNotExists({_id: sanityId, ...synced})
      tx.patch(sanityId, (p) => p.set(synced))
    }

    const EXISTING_SEGMENTS_QUERY = defineQuery(
      `*[_type == "segment" && defined(externalId) && isTest != true]{_id}`,
    )
    const existingSegments = await client.fetch(EXISTING_SEGMENTS_QUERY)

    const resendSegmentIds = new Set(segments.map((s) => `resend-segment-${s.id}`))
    const segmentsToDelete = existingSegments
      .map((s: {_id: string}) => s._id)
      .filter((id: string) => !resendSegmentIds.has(id))

    for (const id of segmentsToDelete) {
      tx.delete(id)
    }

    tx.patch(docId, (p) =>
      p.set({
        importState: 'imported',
        importErrorMessage: '',
        lastImportedAt: new Date().toISOString(),
        segmentCount: segments.length,
        listCount: 0,
      }),
    )

    await tx.commit()

    console.log(`[import-resend-segments] Imported ${segments.length} segments`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({importState: 'error', importErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[import-resend-segments] Failed: ${message}`)
  }
})
