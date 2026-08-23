/**
 * Seed the PDP content model: a brand voice singleton, a set of attribute rules
 * (care / fit / lifestyle / spec / launch), the control plane priority list, and
 * one example SKU enrichment.
 *
 * Products live in Shopify — the seed only provisions the Sanity-side editorial
 * layer. Open the SKU enrichment in Studio and use the product picker to attach a
 * real product from your store; adjust each rule's tags to match your catalog.
 *
 * Usage:
 *   pnpm seed
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
