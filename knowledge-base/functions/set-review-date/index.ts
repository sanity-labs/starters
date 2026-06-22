import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'

// On publish, give every reviewable document a 90-day review clock if it lacks
// one. The blueprint filter (`!defined(reviewByDate)`) both scopes this to
// content that needs a clock and prevents the patch from re-triggering itself.
const REVIEW_PERIOD_DAYS = 90

interface ReviewableDocument {
  _id: string
  _type: string
}

export const handler = documentEventHandler<ReviewableDocument>(async ({context, event}) => {
  const reviewBy = new Date()
  reviewBy.setUTCDate(reviewBy.getUTCDate() + REVIEW_PERIOD_DAYS)

  const client = createClient({...context.clientOptions, apiVersion: '2025-03-01'})

  await client
    .patch(event.data._id)
    .setIfMissing({reviewByDate: reviewBy.toISOString()})
    .commit({dryRun: context.local ?? false})
})
