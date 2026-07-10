/// <reference types="node" />
import {defineBlueprint, defineRobotToken, defineScheduledFunction} from '@sanity/blueprints'
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
        SANITY_SCHEMA_ID: SANITY_SCHEMA_ID ?? 'default',
      },
    }),
  ],
})
