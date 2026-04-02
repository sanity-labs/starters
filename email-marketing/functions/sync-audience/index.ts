import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import groq from 'groq'
import {klaviyoFetch} from '../lib/klaviyo'

const AUDIENCE_QUERY = groq`
  *[_id == $id][0]{
    _id, name, externalId, syncState,
    "list": list->{_id, name, externalId}
  }
`

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08', useCdn: false})
  const docId = event.data._id

  const audience = await client.fetch(AUDIENCE_QUERY, {id: docId})
  if (!audience) {
    console.error(`[sync-audience] Audience ${docId} not found`)
    return
  }

  await client.patch(docId).set({syncState: 'syncing'}).commit()

  try {
    if (!audience.list?.externalId) {
      throw new Error('Parent list must be synced to your email provider first')
    }

    const segmentDefinition = {
      condition_groups: [
        {
          conditions: [
            {
              group_ids: [audience.list.externalId],
              is_member: true,
              type: 'profile-group-membership',
            },
          ],
        },
      ],
    }

    if (audience.externalId) {
      // Update existing segment
      await klaviyoFetch(`/segments/${audience.externalId}`, {
        method: 'PATCH',
        body: {
          data: {
            type: 'segment',
            id: audience.externalId,
            attributes: {name: audience.name},
          },
        },
      })
    } else {
      // Create new segment
      const result = await klaviyoFetch('/segments/', {
        method: 'POST',
        body: {
          data: {
            type: 'segment',
            attributes: {
              name: audience.name,
              definition: segmentDefinition,
            },
          },
        },
      })
      await client.patch(docId).set({externalId: result.data.id}).commit()
    }

    await client
      .patch(docId)
      .set({syncState: 'synced', syncErrorMessage: '', lastSyncedAt: new Date().toISOString()})
      .commit()
    console.log(`[sync-audience] Successfully synced audience "${audience.name}"`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({syncState: 'error', syncErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[sync-audience] Failed to sync audience "${audience.name}": ${message}`)
  }
})
