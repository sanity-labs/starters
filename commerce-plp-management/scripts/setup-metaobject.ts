/**
 * One-time Shopify setup: create the `sanity_plp_collection` metaobject
 * definition that the push-sync writes to. Idempotent — safe to re-run.
 *
 * Reads Admin credentials from the root .env. Prefers Dev Dashboard client
 * credentials (exchanged for a short-lived token automatically):
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 * or a legacy static token:
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN
 *
 * Usage: pnpm shopify:setup
 */
import 'dotenv/config'
import {
  adminConfigFromEnv,
  createAdminClient,
  ensureMetaobjectDefinition,
  METAOBJECT_TYPE,
} from '@starter/commerce/shopify'

const adminConfig = adminConfigFromEnv(process.env)

if (!adminConfig) {
  console.error(
    'Missing Shopify Admin credentials. Set SHOPIFY_STORE_DOMAIN and either\n' +
      '  SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (Dev Dashboard app), or\n' +
      '  SHOPIFY_ADMIN_API_TOKEN (legacy custom app)\n' +
      'in .env',
  )
  process.exit(1)
}

const admin = createAdminClient(adminConfig)

await ensureMetaobjectDefinition(admin)
console.log(`\n✓ Metaobject definition "${METAOBJECT_TYPE}" is ready in ${adminConfig.domain}\n`)
