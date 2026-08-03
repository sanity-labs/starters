// Agent review resolution — closes the triage loop on *accept*.
//
// Accepting an agent suggestion is a document-lifecycle action (the editor
// publishes the staged draft), not a field edit, so nothing in the schema can
// record the outcome. This Function is the hook: when a staged draft is
// published, its content — including `agentReview.status == "staged"` — lands on
// the published document, and we reset the live article's workflow status to
// `idle` and stamp `reviewedAt` (the cooldown the sync reads before re-queuing).
//
// Why the filter is `status == "staged"`: that value only ever reaches the
// *published* document by publishing a staged draft. The sync writes `queued`
// and the triage function writes `in_progress` to the published doc and `staged`
// only to the draft — so `staged` on the published doc is a unique signature of
// "a human just accepted this," and resetting it to `idle` also stops the
// Function from re-triggering itself.
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'

interface ArticleData {
  _id: string
  _type: string
}

export const handler = documentEventHandler<ArticleData>(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2025-01-01', useCdn: false})
  const id = event.data._id

  await client
    .patch(id)
    .set({'agentReview.status': 'idle', 'agentReview.reviewedAt': new Date().toISOString()})
    .commit({dryRun: context.local})

  console.log(`[agent-review-resolve] Accepted agent review for ${id} — reset to idle`)
})
