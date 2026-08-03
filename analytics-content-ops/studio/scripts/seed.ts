/**
 * Seed the dataset with demo content + performance signal.
 *
 * Usage:
 *   pnpm seed          (from the repo root)
 *   pnpm --filter studio seed
 *
 * Uses your Sanity CLI login token via `--with-user-token` — no write token
 * needed for local seeding.
 */
import {getCliClient} from 'sanity/cli'
import {seed} from '../seed/seed'

const client = getCliClient({apiVersion: '2025-01-01'})
const {dataset, projectId} = client.config()

console.log(`Seeding dataset "${dataset}" in project ${projectId}…`)

await seed(client)

console.log('\n✓ Seed complete — open the Studio or run the frontend to explore.')
