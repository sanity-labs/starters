// Analytics sync — Phase 2 (Sanity-native scheduled Function).
//
// This is the exact same pipeline as the Phase 1 GitHub Actions cron
// (`scripts/analytics-sync.ts`): both call `runSync` from
// `@starter/analytics-sync`. Migrating from Phase 1 to Phase 2 is an
// infrastructure swap — retire the workflow, keep the logic.
import {scheduledEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {env} from 'node:process'
import {resolveProvider, runSync, type SyncClient} from '@starter/analytics-sync'

export const handler = scheduledEventHandler(async ({context}) => {
  const startedAt = Date.now()

  // Scheduled functions have no triggering document, so projectId/dataset are
  // injected by the blueprint's `env: {...}` (read from .env at deploy time).
  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env
  const token = context.clientOptions?.token

  if (!projectId || !dataset || !token) {
    console.error(
      `[analytics-sync] Missing client config: projectId=${Boolean(projectId)} dataset=${Boolean(dataset)} token=${Boolean(token)}`,
    )
    throw new Error('Missing Sanity client configuration')
  }

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2025-01-01',
    useCdn: false,
    requestTagPrefix: 'fn.analytics-content-ops.sync',
  })

  const provider = resolveProvider(env.ANALYTICS_PROVIDER)
  console.log(`[analytics-sync] Starting (provider=${provider.name} dataset=${dataset})`)

  const result = await runSync({client: client as unknown as SyncClient, provider})

  console.log(
    `[analytics-sync] Done in ${Date.now() - startedAt}ms — ${result.scored}/${result.totalArticles} scored, ` +
      `${result.counts.trending} trending, ${result.counts.stale} stale, ${result.newlyQueued} newly queued`,
  )
})
