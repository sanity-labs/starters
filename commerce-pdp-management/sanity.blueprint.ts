/// <reference types="node" />
import {defineBlueprint, defineDocumentFunction, defineRobotToken} from '@sanity/blueprints'
import 'dotenv/config'

const {
  SANITY_STUDIO_PROJECT_ID,
  SANITY_STUDIO_DATASET,
  STOREFRONT_REVALIDATE_URL,
  SANITY_REVALIDATE_SECRET,
} = process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in .env',
  )
}

// Env the review-stamp function needs to build a Sanity client at runtime.
const sanityEnv = {
  SANITY_STUDIO_PROJECT_ID,
  SANITY_STUDIO_DATASET,
}

// Env the cache-revalidate function needs to ping the storefront.
const revalidateEnv = {
  STOREFRONT_REVALIDATE_URL: STOREFRONT_REVALIDATE_URL ?? '',
  SANITY_REVALIDATE_SECRET: SANITY_REVALIDATE_SECRET ?? '',
}

export default defineBlueprint({
  resources: [
    defineRobotToken({
      name: 'commerce-pdp-robot',
      label: 'Commerce PDP Robot',
      memberships: [
        {
          resourceType: 'project',
          resourceId: SANITY_STUDIO_PROJECT_ID,
          roleNames: ['editor'],
        },
      ],
    }),

    // Pull-only cache invalidation: on publish of any enrichment document, ping
    // the storefront to revalidate cached PDPs. Nothing is pushed to Shopify.
    defineDocumentFunction({
      name: 'cache-revalidate',
      src: 'functions/dist/cache-revalidate',
      event: {
        on: ['create', 'update', 'delete'],
        filter:
          '_type in ["controlPlane", "attributeRule", "skuEnrichment"] && !(_id in path("drafts.**"))',
        projection: '{_id, _type}',
      },
      timeout: 30,
      env: revalidateEnv,
    }),

    // Stamp reviewedAt when an attribute rule is approved.
    defineDocumentFunction({
      name: 'review-stamp',
      src: 'functions/dist/review-stamp',
      event: {
        on: ['create', 'update'],
        filter: '_type == "attributeRule" && !(_id in path("drafts.**"))',
        projection: '{_id, status, aiEnrichment}',
      },
      timeout: 30,
      robotToken: '$.resources.commerce-pdp-robot.token',
      env: sanityEnv,
    }),
  ],
})
