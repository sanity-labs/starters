import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import groq from 'groq'
import {klaviyoFetch} from '../lib/klaviyo'

const LIST_QUERY = groq`*[_id == $id][0]{_id, name, externalId, syncState}`

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08', useCdn: false})
  const docId = event.data._id

  const list = await client.fetch(LIST_QUERY, {id: docId})
  if (!list) {
    console.error(`[sync-list] List ${docId} not found`)
    return
  }

  await client.patch(docId).set({syncState: 'syncing'}).commit()

  try {
    if (list.externalId) {
      // Update existing list
      await klaviyoFetch(`/lists/${list.externalId}`, {
        method: 'PATCH',
        body: {
          data: {
            type: 'list',
            id: list.externalId,
            attributes: {name: list.name},
          },
        },
      })
    } else {
      // Create new list
      const result = await klaviyoFetch('/lists/', {
        method: 'POST',
        body: {
          data: {
            type: 'list',
            attributes: {name: list.name},
          },
        },
      })
      await client.patch(docId).set({externalId: result.data.id}).commit()
    }

    await client
      .patch(docId)
      .set({syncState: 'synced', syncErrorMessage: '', lastSyncedAt: new Date().toISOString()})
      .commit()
    console.log(`[sync-list] Successfully synced list "${list.name}"`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({syncState: 'error', syncErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[sync-list] Failed to sync list "${list.name}": ${message}`)
  }
})
