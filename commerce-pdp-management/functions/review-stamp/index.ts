// Review stamping.
//
// When an attribute rule reaches `status: approved`, stamp `aiEnrichment.reviewedAt`
// if it isn't set yet, so the approval time is captured without the reviewer
// filling it in by hand. The patch only runs when the timestamp is missing, so it
// does not loop on its own resulting update event.
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {env} from 'node:process'

type EventData = {
  _id: string
  status?: string
  aiEnrichment?: {reviewedAt?: string}
}

const RULE_QUERY = defineQuery(`*[_id == $id][0]{status, "reviewedAt": aiEnrichment.reviewedAt}`)

export const handler = documentEventHandler(async ({context, event}) => {
  const data = event.data as EventData
  if (data.status !== 'approved') return

  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token
  if (!projectId || !dataset || !token) {
    throw new Error('Missing Sanity client configuration')
  }

  const client = createClient({projectId, dataset, token, apiVersion: '2025-01-01', useCdn: false})

  const current = await client.fetch(RULE_QUERY, {id: data._id})
  if (current?.status !== 'approved' || current?.reviewedAt) return

  await client
    .patch(data._id)
    .setIfMissing({aiEnrichment: {}})
    .set({'aiEnrichment.reviewedAt': new Date().toISOString()})
    .commit()

  console.log(`Stamped reviewedAt on approved rule ${data._id}`)
})
