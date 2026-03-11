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

import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const dir = import.meta.dirname!
const rootDir = resolve(dir, '../..')

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

// ── 1. Deploy blueprint ──────────────────────────────────────────────────────
// Init the stack (first run only), then deploy the blueprint.
// Must run from the monorepo root where sanity.blueprint.ts lives.

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
    // Stack already exists — link local config to it
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

// ── 2. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
sanity('schema', 'deploy')

// ── 3. Run typegen ──────────────────────────────────────────────────────────

heading('Run typegen')
sanity('schema', 'extract')
sanity('typegen', 'generate')

// ── 4. Import seed data ──────────────────────────────────────────────────────

heading('Import seed data')
sanity('dataset', 'import', 'seed/data.ndjson', dataset!, '--missing')

console.log('\n✓ Bootstrap complete\n')
