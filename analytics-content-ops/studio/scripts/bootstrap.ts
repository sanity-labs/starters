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
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
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
// email-marketing).
//
// Only skip init+promote when the local blueprint config is for THIS project. A
// stale config from a different project (e.g. after changing
// SANITY_STUDIO_PROJECT_ID) would otherwise silently deploy to the wrong stack.
// The config drops its `projectId` once promoted to org scope, so we also record
// the project in a sidecar marker to compare on later runs.
const blueprintConfig = resolve(rootDir, '.sanity/blueprint.config.json')
const projectMarker = resolve(rootDir, '.sanity/bootstrap-project')

if (existsSync(blueprintConfig)) {
  const marker = existsSync(projectMarker) ? readFileSync(projectMarker, 'utf8').trim() : null
  const configProjectId = (() => {
    try {
      return (JSON.parse(readFileSync(blueprintConfig, 'utf8')).projectId as string) || null
    } catch {
      return null
    }
  })()
  const linkedProject = marker ?? configProjectId
  if (linkedProject && linkedProject !== projectId) {
    console.log(
      `Blueprint config is for project "${linkedProject}", not "${projectId}" — re-initializing`,
    )
    rmSync(blueprintConfig)
  }
}

if (existsSync(blueprintConfig)) {
  console.log('Blueprint already initialized for this project — skipping init + promote')
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

// Record which project this stack belongs to, so a later run for a different
// project detects the mismatch above instead of deploying to the wrong stack.
writeFileSync(projectMarker, projectId!)

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
