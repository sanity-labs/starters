/// <reference types="node" />
import {
  defineBlueprint,
  defineDocumentFunction,
  defineRobotToken,
  defineScheduledFunction,
} from '@sanity/blueprints'
import 'dotenv/config'

const {SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, ANALYTICS_PROVIDER, SANITY_SCHEMA_ID} =
  process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in .env',
  )
}

// Runtime env shared by both scheduled functions. Scheduled functions get no
// triggering-document context, so projectId/dataset must be injected here.
const sharedEnv = {
  SANITY_STUDIO_PROJECT_ID,
  SANITY_STUDIO_DATASET,
  ANALYTICS_PROVIDER: ANALYTICS_PROVIDER ?? 'fixture',
}

export default defineBlueprint({
  resources: [
    // Scoped robot token the functions run as, so their writes use an explicit
    // least-privilege (editor) identity rather than an ambient default token.
    defineRobotToken({
      name: 'analytics-content-ops-robot',
      label: 'Analytics Content Ops Robot',
      memberships: [
        {
          resourceType: 'project',
          resourceId: SANITY_STUDIO_PROJECT_ID,
          roleNames: ['editor'],
        },
      ],
    }),

    // Phase 2: nightly analytics sync. Replaces the GitHub Actions cron in
    // .github/workflows/analytics-sync.yml with identical logic.
    defineScheduledFunction({
      name: 'analytics-sync',
      src: 'functions/dist/analytics-sync',
      event: {expression: '0 3 * * *'},
      timezone: 'America/New_York',
      timeout: 120,
      robotToken: '$.resources.analytics-content-ops-robot.token',
      env: sharedEnv,
    }),

    // Content Agent triage, 30 minutes after the sync so newly-stale articles
    // are already flagged. Needs the deployed schema id for Agent Actions.
    defineScheduledFunction({
      name: 'agent-triage',
      src: 'functions/dist/agent-triage',
      event: {expression: '30 3 * * *'},
      timezone: 'America/New_York',
      timeout: 300,
      robotToken: '$.resources.analytics-content-ops-robot.token',
      env: {
        SANITY_STUDIO_PROJECT_ID,
        SANITY_STUDIO_DATASET,
        // Deployed schema id for Agent Actions. The Studio workspace is named
        // "default" (studio/sanity.config.ts), so its deployed id is
        // `_.schemas.default`. Override via SANITY_SCHEMA_ID in .env if renamed.
        SANITY_SCHEMA_ID: SANITY_SCHEMA_ID ?? '_.schemas.default',
      },
    }),

    // Closes the triage loop on accept. Fires when a staged draft is published
    // (its `agentReview.status == "staged"` lands on the published doc) and
    // resets the live article's status to idle + stamps reviewedAt. The
    // `status == "staged"` filter both scopes it to genuine accepts and prevents
    // it from re-triggering on its own idle write. Dismiss is handled in Studio.
    defineDocumentFunction({
      name: 'agent-review-resolve',
      src: 'functions/dist/agent-review-resolve',
      event: {
        on: ['create', 'update'],
        filter: '_type == "article" && agentReview.status == "staged"',
      },
      robotToken: '$.resources.analytics-content-ops-robot.token',
    }),
  ],
})
