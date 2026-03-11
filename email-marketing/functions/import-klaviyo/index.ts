import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {klaviyoFetch} from '../lib/klaviyo'

type KlaviyoItem = {id: string; name: string}

async function fetchAllPages(path: string): Promise<KlaviyoItem[]> {
  const items: KlaviyoItem[] = []
  let url: string | null = path

  while (url) {
    const result = await klaviyoFetch(url)
    for (const item of result.data ?? []) {
      items.push({id: item.id, name: item.attributes?.name ?? 'Unnamed'})
    }
    const nextLink = result.links?.next
    if (nextLink) {
      url = nextLink.replace('https://a.klaviyo.com/api', '')
    } else {
      url = null
    }
  }

  return items
}

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08', useCdn: false})
  const docId = event.data._id

  await client.patch(docId).set({importState: 'importing'}).commit()

  try {
    const [lists, segments] = await Promise.all([
      fetchAllPages('/lists/'),
      fetchAllPages('/segments/'),
    ])

    // Batch all upserts into a single transaction
    const tx = client.transaction()

    for (const list of lists) {
      const sanityId = `klaviyo-list-${list.id}`
      tx.createIfNotExists({_id: sanityId, _type: 'list', name: list.name, externalId: list.id})
      tx.patch(sanityId, (p) => p.set({_type: 'list', name: list.name, externalId: list.id}))
    }

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

    tx.patch(docId, (p) =>
      p.set({
        importState: 'imported',
        importErrorMessage: '',
        lastImportedAt: new Date().toISOString(),
        listCount: lists.length,
        segmentCount: segments.length,
      }),
    )

    await tx.commit()

    console.log(`[import-klaviyo] Imported ${lists.length} lists and ${segments.length} segments`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({importState: 'error', importErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[import-klaviyo] Failed: ${message}`)
  }
})
