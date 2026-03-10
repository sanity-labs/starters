/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Deploy blueprint
 *  2. Deploy schema to the Content Lake
 *  3. Run typegen (schema extract + type generation)
 *  4. Import seed data (ndjson)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/)
 */

import {execSync} from 'node:child_process'
import {resolve} from 'node:path'

const dir = import.meta.dirname!
const studioDir = resolve(dir, '..')
const rootDir = resolve(dir, '../..')

const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

function heading(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(60 - label.length)}`)
}

// ── 1. Deploy blueprint ──────────────────────────────────────────────────────

heading('Deploy blueprint')
execSync('npx sanity blueprints deploy', {stdio: 'inherit', cwd: rootDir})

// ── 2. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
execSync('npx sanity schema deploy', {stdio: 'inherit', cwd: studioDir})

// ── 3. Run typegen ──────────────────────────────────────────────────────────

heading('Run typegen')
execSync('npx sanity schema extract && npx sanity typegen generate', {
  stdio: 'inherit',
  cwd: studioDir,
})

// ── 4. Import seed data ──────────────────────────────────────────────────────

heading('Import seed data')
execSync(`npx sanity dataset import seed/data.ndjson ${dataset} --missing`, {
  stdio: 'inherit',
  cwd: studioDir,
})

console.log('\n✓ Bootstrap complete\n')
