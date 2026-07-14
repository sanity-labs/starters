/// <reference types="node" />
import {defineBlueprint, defineDocumentFunction, defineRobotToken} from '@sanity/blueprints'
import 'dotenv/config'

const {
  SANITY_STUDIO_PROJECT_ID,
  SANITY_STUDIO_DATASET,
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_ADMIN_API_TOKEN,
  SHOPIFY_ADMIN_API_VERSION,
} = process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in .env',
  )
}

// Shopify Admin credentials the push-sync functions need at runtime. These are
// sensitive; they live only on the Function runtime, never in the browser. Dev
// Dashboard apps use Client ID/Secret (exchanged for a short-lived token at
// runtime); a legacy static Admin token is also supported.
const shopifyEnv = {
  SANITY_STUDIO_PROJECT_ID,
  SANITY_STUDIO_DATASET,
  SHOPIFY_STORE_DOMAIN: SHOPIFY_STORE_DOMAIN ?? '',
  SHOPIFY_CLIENT_ID: SHOPIFY_CLIENT_ID ?? '',
  SHOPIFY_CLIENT_SECRET: SHOPIFY_CLIENT_SECRET ?? '',
  SHOPIFY_ADMIN_API_TOKEN: SHOPIFY_ADMIN_API_TOKEN ?? '',
  SHOPIFY_ADMIN_API_VERSION: SHOPIFY_ADMIN_API_VERSION ?? '2025-07',
}

export default defineBlueprint({
  resources: [
    defineRobotToken({
      name: 'commerce-plp-robot',
      label: 'Commerce PLP Robot',
      memberships: [
        {
          resourceType: 'project',
          resourceId: SANITY_STUDIO_PROJECT_ID,
          roleNames: ['editor'],
        },
      ],
    }),

    // Push-sync: write the sanity_plp_collection metaobject on publish, then
    // stamp syncStatus on the document. Fires on published (non-draft) writes.
    defineDocumentFunction({
      name: 'collection-sync',
      src: 'functions/dist/collection-sync',
      event: {
        on: ['create', 'update'],
        filter: '_type == "collectionEnrichment" && !(_id in path("drafts.**"))',
        projection: '{_id, handle}',
      },
      timeout: 60,
      robotToken: '$.resources.commerce-plp-robot.token',
      env: shopifyEnv,
    }),

    // Badge vocabulary re-sync: keep Shopify metaobjects current when a shared
    // productBadge label/color changes.
    defineDocumentFunction({
      name: 'badge-resync',
      src: 'functions/dist/badge-resync',
      event: {
        on: ['create', 'update'],
        filter: '_type == "productBadge" && !(_id in path("drafts.**"))',
        projection: '{_id}',
      },
      timeout: 120,
      robotToken: '$.resources.commerce-plp-robot.token',
      env: shopifyEnv,
    }),
  ],
})
