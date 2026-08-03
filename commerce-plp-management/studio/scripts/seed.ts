/**
 * Seed the badge vocabulary and example collection enrichment documents.
 *
 * Products live in Shopify, so the seed only provisions the Sanity-side content:
 * the shared badge vocabulary plus two example collections (one shopify-native,
 * one sanity-custom). Open them in Studio and use the product picker to attach
 * real products from your store.
 *
 * Usage:
 *   pnpm seed        (store-agnostic default: badges + two example collections)
 *   pnpm seed:demo   (the fully-merchandised "Sanity Swag Store" demo)
 *
 * Set SEED_FILE to import a different ndjson file from studio/seed/.
 */

import {createReadStream} from 'node:fs'
import {createInterface} from 'node:readline'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-01-01'})
const fileName = process.env.SEED_FILE ?? 'data.ndjson'
const file = resolve(import.meta.dirname!, '../seed/', fileName)

const rl = createInterface({input: createReadStream(file), crlfDelay: Infinity})

const tx = client.transaction()
let count = 0

for await (const line of rl) {
  const trimmed = line.trim()
  if (!trimmed) continue
  tx.createOrReplace(JSON.parse(trimmed))
  count++
}

await tx.commit()
console.log(`\n✓ Seeded ${count} documents\n`)
