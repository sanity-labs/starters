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
      name: 'import-klaviyo',
      src: 'functions/dist/import-klaviyo',
      event: {
        on: ['update'],
        filter: '_type == "klaviyoImport" && importState == "requested"',
        projection: '{_id, importState}',
      },
    }),
    defineScheduledFunction({
      name: 'scheduled-import-klaviyo',
      src: 'functions/dist/scheduled-import-klaviyo',
      // Fires at midnight and noon Pacific time
      event: {expression: '0 0,12 * * *'},
      timezone: 'America/Los_Angeles',
      robotToken: '$.resources.email-marketing-robot.token',
      env: {
        SANITY_STUDIO_PROJECT_ID,
        SANITY_STUDIO_DATASET,
      },
    }),
    defineDocumentFunction({
      name: 'on-promotion-approved',
      src: 'functions/dist/on-promotion-approved',
      timeout: 60,
      event: {
        on: ['create', 'update'],
        filter: '_type == "workflow.state" && status == "approved"',
        projection: '{_id, status, promotionId}',
      },
    }),
  ],
})
