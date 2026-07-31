/**
 * Analytics sync — Phase 1 entrypoint (standalone / GitHub Actions cron).
 *
 * Reads analytics from the configured provider, classifies each article into an
 * action-enabling performance signal, and upserts `articlePerformance`
 * companion documents in Sanity. Newly-stale articles are flagged for Content
 * Agent triage. The heavy lifting lives in `@starter/analytics-sync` so this
 * file — and the sibling scheduled Function — stay tiny.
 *
 * Usage:
 *   pnpm analytics-sync            # uses .env in the repo root
 *
 * Required env:
 *   SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, SANITY_API_WRITE_TOKEN
 * Optional:
 *   ANALYTICS_PROVIDER=fixture|ga4   (default: fixture)
 */
import {createClient} from '@sanity/client'
import {config as loadEnv} from 'dotenv'
import {resolveProvider, runSync} from '@starter/analytics-sync'

loadEnv({path: '.env.local'})
loadEnv()

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN

if (!projectId || !token) {
  console.error(
    'Missing env. Set SANITY_STUDIO_PROJECT_ID and SANITY_API_WRITE_TOKEN (Editor token) in .env',
  )
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-01-01',
  useCdn: false,
})

const provider = resolveProvider(process.env.ANALYTICS_PROVIDER)

console.log(`Running analytics sync (provider=${provider.name}, dataset=${dataset})…`)

const result = await runSync({client, provider})

console.log('✓ Sync complete')
console.log(
  `  ${result.scored}/${result.totalArticles} articles scored · ` +
    `${result.counts.trending} trending · ${result.counts.stale} stale · ` +
    `${result.counts.archiveCandidates} archive candidates`,
)
if (result.newlyQueued > 0) {
  console.log(`  ${result.newlyQueued} newly-stale article(s) queued for Content Agent triage`)
}
