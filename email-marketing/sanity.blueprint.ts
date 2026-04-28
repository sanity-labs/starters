/// <reference types="node" />
import {
  defineBlueprint,
  defineDocumentFunction,
  defineRobotToken,
  defineScheduledFunction,
} from '@sanity/blueprints'
import 'dotenv/config'

const {SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET} = process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in .env',
  )
}

export default defineBlueprint({
  resources: [
    defineRobotToken({
      name: 'email-marketing-robot',
      label: 'Email Marketing Robot',
      memberships: [
        {
          resourceType: 'project',
          resourceId: SANITY_STUDIO_PROJECT_ID,
          roleNames: ['editor'],
        },
      ],
    }),
    defineDocumentFunction({
      name: 'import-resend-segments',
      src: 'functions/dist/import-resend-segments',
      project: SANITY_STUDIO_PROJECT_ID,
      event: {
        on: ['update'],
        filter: '_type == "espImport" && importState == "requested"',
        projection: '{_id, importState}',
      },
    }),
    defineScheduledFunction({
      name: 'scheduled-import-resend-segments',
      src: 'functions/dist/scheduled-import-resend-segments',
      project: SANITY_STUDIO_PROJECT_ID,
      event: {expression: 'every 5 minutes'},
      robotToken: '$.resources.email-marketing-robot.token',
      env: {
        SANITY_STUDIO_PROJECT_ID,
        SANITY_STUDIO_DATASET,
      },
    }),
    defineDocumentFunction({
      name: 'on-promotion-approved',
      src: 'functions/dist/on-promotion-approved',
      project: SANITY_STUDIO_PROJECT_ID,
      timeout: 60,
      event: {
        on: ['create', 'update'],
        filter: '_type == "workflow.state" && status == "approved"',
        projection: '{_id, status, promotionId}',
      },
    }),
    defineDocumentFunction({
      name: 'on-promotion-test-send',
      src: 'functions/dist/on-promotion-test-send',
      project: SANITY_STUDIO_PROJECT_ID,
      timeout: 60,
      event: {
        on: ['update'],
        filter: '_type == "promotion" && testSend.status == "requested"',
        projection: '{_id, testSend}',
      },
    }),
  ],
})
