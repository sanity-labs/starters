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
import {seed} from '../seed/seed'

const dir = import.meta.dirname!
const rootDir = resolve(dir, '../..')

const client = getCliClient({apiVersion: '2025-01-01'})
const {projectId} = client.config()

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

// Scheduled functions require an organization-scoped stack. Init creates a
// project-scoped stack; promote moves it to org scope (same pattern as
// email-marketing). Skip both when local config already exists.
const blueprintConfig = resolve(rootDir, '.sanity/blueprint.config.json')
if (existsSync(blueprintConfig)) {
  console.log('Blueprint already initialized — skipping init + promote')
} else {
  run(
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
      '--blueprint-type',
      'ts',
    ],
    {cwd: rootDir},
  )
  run(
    'pnpm',
    ['exec', 'sanity', 'blueprints', 'promote', '--force', '--new-stack-name', `${projectId}-prod`],
    {cwd: rootDir},
  )
}

run('pnpm', ['exec', 'sanity', 'blueprints', 'deploy'], {cwd: rootDir})

// ── 2. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
sanity('schema', 'deploy')

// ── 3. Run typegen ──────────────────────────────────────────────────────────

heading('Run typegen')
sanity('schema', 'extract')
sanity('typegen', 'generate')

// ── 4. Seed demo content + performance signal ────────────────────────────────

heading('Seed demo content')
await seed(client)

console.log('\n✓ Bootstrap complete\n')
