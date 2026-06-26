/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Full bootstrap steps:
 *  1. Deploy blueprint
 *  2. Add CORS origin for the Angular blog (localhost:4200)
 *  3. Deploy schema to the Content Lake
 *  4. Run typegen (schema extract + type generation)
 *  5. Import seed data (ndjson)
 *  6. Upload seed images (logo, author avatar, post cover images)
 *
 * Usage:
 *   pnpm bootstrap              Full bootstrap
 *   pnpm bootstrap:seed         Import seed ndjson + upload images only
 *   pnpm bootstrap -- --seed-only   Same as bootstrap:seed
 */

import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'
import {getSeedDocumentIds, seedDocumentsExist} from './seed-data'
import {uploadSeedImages} from './seed-images'

const dir = import.meta.dirname!
const rootDir = resolve(dir, '../..')
const seedDataPath = resolve(dir, '../seed/data.ndjson')
const seedImagesDir = resolve(dir, '../seed/images')

const seedOnly = process.argv.includes('--seed-only')

const client = getCliClient({apiVersion: '2025-01-01'})
const {projectId, dataset} = client.config()

function run(cmd: string, args: string[], options?: {cwd?: string}) {
  execFileSync(cmd, args, {stdio: 'inherit', ...options})
}

function sanity(...args: string[]) {
  run('pnpm', ['exec', 'sanity', ...args])
}

function heading(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(60 - label.length)}`)
}

async function importSeedData(): Promise<void> {
  heading('Import seed data')

  const documentIds = getSeedDocumentIds(seedDataPath)

  if (await seedDocumentsExist(client, documentIds)) {
    console.log('  All seed documents already exist — skipping import')
    return
  }

  sanity('dataset', 'import', 'seed/data.ndjson', dataset!, '--missing')
}

async function uploadSeedImagesStep(): Promise<void> {
  heading('Upload seed images')
  await uploadSeedImages(client, seedImagesDir)
}

async function runSeedOnly(): Promise<void> {
  await importSeedData()
  await uploadSeedImagesStep()
  console.log('\n✓ Seed complete\n')
}

async function runFullBootstrap(): Promise<void> {
  // ── 1. Deploy blueprint ──────────────────────────────────────────────────

  heading('Deploy blueprint')

  run('pnpm', ['--filter', '@starter/functions', 'run', 'build'], {cwd: rootDir})

  const blueprintConfig = resolve(rootDir, '.sanity/blueprint.config.json')
  if (!existsSync(blueprintConfig)) {
    try {
      execFileSync(
        'pnpm',
        [
          'exec',
          'sanity',
          'blueprints',
          'init',
          '--stack-name',
          'production',
          '--project-id',
          projectId!,
        ],
        {cwd: rootDir, stdio: 'pipe'},
      )
    } catch {
      console.log('Stack already exists — linking local config')
      run(
        'pnpm',
        [
          'exec',
          'sanity',
          'blueprints',
          'config',
          '--edit',
          '--project-id',
          projectId!,
          '--stack',
          'production',
        ],
        {cwd: rootDir},
      )
    }
  }

  run('pnpm', ['exec', 'sanity', 'blueprints', 'deploy'], {cwd: rootDir})

  // ── 2. Add CORS origin ─────────────────────────────────────────────────────

  heading('Add CORS origin')

  const previewOrigin = (
    process.env['SANITY_STUDIO_PREVIEW_URL'] ?? 'http://localhost:4200'
  ).replace(/\/$/, '')

  try {
    sanity('cors', 'add', previewOrigin, '--credentials')
    console.log(`Added CORS origin ${previewOrigin}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/already|exist/i.test(message)) {
      console.log(`CORS origin ${previewOrigin} already configured`)
    } else {
      console.warn(`Could not add CORS origin: ${message}`)
      console.warn(
        `Run manually: cd studio && pnpm exec sanity cors add ${previewOrigin} --credentials`,
      )
    }
  }

  // ── 3. Deploy schema ───────────────────────────────────────────────────────

  heading('Deploy schema')
  sanity('schema', 'deploy')

  // ── 4. Run typegen ─────────────────────────────────────────────────────────

  heading('Run typegen')
  sanity('schema', 'extract')
  sanity('typegen', 'generate')

  // ── 5–6. Seed content ────────────────────────────────────────────────────────

  await importSeedData()
  await uploadSeedImagesStep()

  console.log('\n✓ Bootstrap complete\n')
}

if (seedOnly) {
  await runSeedOnly()
} else {
  await runFullBootstrap()
}
