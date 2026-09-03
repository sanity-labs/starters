// Review stamping.
//
// When an attribute rule reaches `status: approved`, stamp `aiEnrichment.reviewedAt`
// if it isn't set yet, so the approval time is captured without the reviewer
// filling it in by hand. When a rule leaves `approved` (sent back to draft or
// in-review), clear the stamp so the next approval records a fresh timestamp
// rather than the old one.
//
// Each patch only runs when the document is not already in the target state, so
// the function does not loop on its own resulting update event.
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

  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token
  if (!projectId || !dataset || !token) {
    throw new Error('Missing Sanity client configuration')
  }

  const client = createClient({projectId, dataset, token, apiVersion: '2025-01-01', useCdn: false})

  // Re-read rather than trusting the event payload, so a stale event never
  // stamps or clears against a status that has since changed.
  const current = await client.fetch(RULE_QUERY, {id: data._id})
  if (!current) return

  const isApproved = current.status === 'approved'
  const hasStamp = Boolean(current.reviewedAt)

  if (isApproved && !hasStamp) {
    await client
      .patch(data._id)
      .setIfMissing({aiEnrichment: {}})
      .set({'aiEnrichment.reviewedAt': new Date().toISOString()})
      .commit()
    console.log(`Stamped reviewedAt on approved rule ${data._id}`)
    return
  }

  if (!isApproved && hasStamp) {
    await client.patch(data._id).unset(['aiEnrichment.reviewedAt']).commit()
    console.log(`Cleared reviewedAt on rule ${data._id} (status: ${current.status})`)
  }
})
