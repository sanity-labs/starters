import {
  defineBlueprint,
  defineDocumentFunction,
  defineRobotToken,
  defineScheduledFunction,
} from '@sanity/blueprints'

// Load env — jiti (which loads this file) doesn't support process.loadEnvFile,
// so we parse studio/.env manually. import.meta.dirname is synthesized by jiti.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

try {
  const envFile = resolve(import.meta.dirname ?? process.cwd(), 'studio/.env')
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
      process.env[match[1].trim()] ??= value
    }
  }
} catch {}

const {SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET} = process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in studio/.env',
  )
}

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'set-review-date',
      src: 'functions/dist/set-review-date',
      event: {
        on: ['create', 'update'],
        // Scope to reviewable content and skip docs that already have a clock —
        // this also stops the function's own patch from re-triggering it.
        filter: '_type in ["helpArticle", "faq", "playbook", "policy"] && !defined(reviewByDate)',
        projection: '{_id, _type}',
      },
    }),

    // ── Agent Insights classification ────────────────────────────────
    // Robot token (Editor) used by the scheduled classifier to read
    // conversations and write classification results back.
    defineRobotToken({
      name: 'kb-insights-robot',
      label: 'Knowledge Base Insights Robot',
      memberships: [
        {resourceType: 'project', resourceId: SANITY_STUDIO_PROJECT_ID, roleNames: ['editor']},
      ],
    }),
    // Hourly pass over unclassified conversations (the package applies a
    // 10-minute cooldown so in-flight chats are left alone). Needs an
    // ANTHROPIC_API_KEY function env var — bootstrap sets it, or:
    //   npx sanity functions env add classify-conversations ANTHROPIC_API_KEY <key>
    defineScheduledFunction({
      name: 'classify-conversations',
      src: 'functions/dist/classify-conversations',
      event: {expression: '0 * * * *'},
      timezone: 'Etc/UTC',
      robotToken: '$.resources.kb-insights-robot.token',
      // Scheduled functions have no triggering document, so project ID and
      // dataset are injected here at deploy time.
      env: {
        SANITY_STUDIO_PROJECT_ID,
        SANITY_STUDIO_DATASET,
      },
    }),
  ],
})
