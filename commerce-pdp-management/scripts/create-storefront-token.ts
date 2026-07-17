/**
 * Mint a public Shopify Storefront API access token from the Admin credentials in
 * the root .env, then print the lines to paste into studio/.env and frontend/.env.
 *
 * PDP enrichment is pull-only — the Admin credentials are used only here, to mint
 * the public Storefront token the Studio picker and storefront read with. Dev
 * Dashboard apps don't expose a static Storefront token in the UI, so this creates
 * one via the Admin API. Run once; re-running creates additional tokens.
 *
 * Usage: pnpm shopify:storefront-token
 */
import 'dotenv/config'
import {
  adminConfigFromEnv,
  createAdminClient,
  createStorefrontAccessToken,
} from '@starter/commerce/shopify'

const adminConfig = adminConfigFromEnv(process.env)

if (!adminConfig) {
  console.error(
    'Missing Shopify Admin credentials. Set SHOPIFY_STORE_DOMAIN and either\n' +
      '  SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, or SHOPIFY_ADMIN_API_TOKEN\n' +
      'in .env',
  )
  process.exit(1)
}

const admin = createAdminClient(adminConfig)
const token = await createStorefrontAccessToken(admin)

console.log('\n✓ Storefront access token created. Add it to your env files:\n')
console.log('studio/.env:')
console.log(`  SANITY_STUDIO_SHOPIFY_STOREFRONT_TOKEN=${token}\n`)
console.log('frontend/.env:')
console.log(`  NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=${token}\n`)
