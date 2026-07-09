// Scheduled function: runs hourly (cron in sanity.blueprint.ts) and classifies
// conversations saved by the chat surfaces' insights telemetry — extracting
// success scores, sentiment, and content gaps that populate the Studio's
// Agent Insights dashboard. Telemetry alone stores raw conversations;
// this classification pass is what fills in the metrics.
import {anthropic} from '@ai-sdk/anthropic'
import {classifyConversations} from '@sanity/agent-context/insights'
import {createClient} from '@sanity/client'
import {scheduledEventHandler} from '@sanity/functions'

export const handler = scheduledEventHandler(async ({context}) => {
  // Scheduled functions have no triggering document, so project ID and dataset
  // are not auto-populated — the blueprint injects them via env at deploy time.
  // The token comes from the blueprint's robot token (Editor role).
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_STUDIO_DATASET
  const token = context.clientOptions?.token

  if (!projectId || !dataset || !token) {
    throw new Error(
      `[classify-conversations] Missing client config: projectId=${Boolean(projectId)} dataset=${Boolean(dataset)} token=${Boolean(token)}. SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in the function env (via the blueprint), and the robotToken must resolve.`,
    )
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2025-03-01',
    token,
    useCdn: false,
    requestTagPrefix: 'fn.kb.classify',
  })

  const result = await classifyConversations({
    client,
    model: anthropic('claude-haiku-4-5'),
    // Shares classification metrics (scores, sentiment, gap counts) with
    // Sanity — never conversation content. Remove to opt out.
    telemetry: {shareMetrics: true},
  })

  console.log(
    `[classify-conversations] Classified ${result.successCount}/${result.totalFound} conversations${result.errorCount > 0 ? ` (${result.errorCount} failed)` : ''}`,
  )
})
