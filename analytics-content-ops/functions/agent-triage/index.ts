// Content Agent triage — the automated "nightly catalog triage" journey.
//
// Runs after the analytics sync. Loads the articles the sync flagged
// (`agentReview.status == "queued"`), asks Agent Actions to write reasoning +
// improvement opportunities and to draft better SEO metadata, and stages the
// result as an unpublished *draft* so a human reviews before anything goes
// live. Marks each article "staged" for the ops lead to pick up.
//
// Safety layers (per PRD): the GROQ filter scopes the agent to queued articles;
// all writes land in the draft, never the published document; and the agent
// only touches editorial/SEO fields — never the read-only analytics signal.
import {scheduledEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {env} from 'node:process'

const QUEUED_QUERY = defineQuery(`*[_type == "article" && agentReview.status == "queued"]{
  _id,
  title,
  "tier": *[_type == "articlePerformance" && article._ref == ^._id][0].performanceTier,
  "referrer": *[_type == "articlePerformance" && article._ref == ^._id][0].topReferrer,
  "percentile": *[_type == "articlePerformance" && article._ref == ^._id][0].catalogPercentile
}`)

interface QueuedArticle {
  _id: string
  title?: string
  tier?: string
  referrer?: string
  percentile?: number
}

const INSTRUCTION = `You are a content operations agent triaging an underperforming article.

Its analytics signal — treat as read-only context, do not restate verbatim:
- performance tier: $tier
- top acquisition channel: $referrer
- catalog percentile: $percentile (0 = worst, 100 = best)

First, write "agentReview.agentNotes": one short paragraph of reasoning about why this piece may be underperforming, followed by exactly three specific, concrete improvement opportunities as a numbered list. Ground everything in the article's actual content.

Then draft improved SEO metadata that stays accurate to the content:
- "seoTitle": compelling and specific, 70 characters or fewer.
- "seoDescription": informative and enticing, 160 characters or fewer.

Optimize primarily for the "$referrer" channel: organic → search intent and keywords; social → a scroll-stopping hook; email → narrative depth with a clear call to action; direct or referral → updated facts and internal linking.`

export const handler = scheduledEventHandler(async ({context}) => {
  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token
  // Agent Actions resolves against the deployed schema id, which carries a
  // `_.schemas.` prefix. The Studio workspace is named "default"
  // (studio/sanity.config.ts), so the deployed id is `_.schemas.default`.
  const schemaId = env.SANITY_SCHEMA_ID || '_.schemas.default'

  if (!projectId || !dataset || !token) {
    throw new Error('Missing Sanity client configuration')
  }

  // apiVersion "vX" enables Agent Actions.
  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: 'vX',
    useCdn: false,
    requestTagPrefix: 'fn.analytics-content-ops.triage',
  })

  const queued = await client.fetch<QueuedArticle[]>(QUEUED_QUERY, {}, {tag: 'triage.queued'})
  if (queued.length === 0) {
    console.log('[agent-triage] No queued articles — nothing to do')
    return
  }

  // One named batch per nightly run — the "Stale Content Refresh" the ops lead
  // reviews in the morning. (Promoting this to a first-class Content Release via
  // the Releases API is the documented production upgrade — see AGENT.md.)
  const releaseId = `stale-content-refresh-${new Date().toISOString().slice(0, 10)}`
  console.log(`[agent-triage] Triaging ${queued.length} article(s) into "${releaseId}"`)

  let staged = 0
  for (const article of queued) {
    const id = article._id.replace(/^drafts\./, '')
    const draftId = `drafts.${id}`
    try {
      await client
        .patch(id)
        .set({'agentReview.status': 'in_progress'})
        .commit({tag: 'triage.start'})

      // Ensure a draft exists so the agent's edits stage instead of publishing.
      const published = await client.getDocument(id)
      if (published) {
        const {_rev: _drop, ...rest} = published
        await client.createIfNotExists({...rest, _id: draftId})
      }

      await client.agent.action.generate({
        schemaId,
        documentId: draftId,
        instruction: INSTRUCTION,
        instructionParams: {
          tier: {type: 'constant', value: article.tier ?? 'stale'},
          referrer: {type: 'constant', value: article.referrer ?? 'organic'},
          percentile: {type: 'constant', value: String(article.percentile ?? 0)},
        },
        // `path` takes an array of segments, not a JSONMatch dot-string — a
        // dot-string is read as one literal top-level field and silently
        // dropped. (Note this differs from client.patch().set(), where dot
        // notation is valid.)
        target: [
          {path: ['agentReview', 'agentNotes']},
          {path: ['seoTitle']},
          {path: ['seoDescription']},
        ],
      })

      await client
        .patch(draftId)
        .set({
          'agentReview.status': 'staged',
          'agentReview.releaseId': releaseId,
          'agentReview.reviewedAt': new Date().toISOString(),
        })
        .commit({tag: 'triage.stage'})

      staged++
      console.log(`[agent-triage] Staged ${id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[agent-triage] Failed on ${id}: ${message}`)
      // Return to the queue so the next run can retry.
      await client
        .patch(id)
        .set({'agentReview.status': 'queued'})
        .commit({tag: 'triage.retry'})
        .catch(() => {
          // best-effort requeue; the next scheduled run retries regardless
        })
    }
  }

  console.log(`[agent-triage] Done — staged ${staged}/${queued.length} into "${releaseId}"`)
})
