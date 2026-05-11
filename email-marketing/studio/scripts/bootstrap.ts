/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Deploy schema to the Content Lake
 *  2. Import seed data (ndjson)
 *  3. Deploy blueprint (functions)
 *  4. Run typegen (schema extract + type generation)
 *  5. Prompt for Klaviyo API key (optional)
 *  6. Trigger Klaviyo import (if key was provided)
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

const client = getCliClient({apiVersion: '2026-04-08'}).withConfig({
  requestTagPrefix: 'kit.email-marketing',
})
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

function prompt(question: string): string {
  process.stderr.write(question)
  try {
    return execFileSync('bash', ['-c', 'read -r val && echo "$val"'], {
      stdio: ['inherit', 'pipe', 'inherit'],
    })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

// ── 1. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
sanity('schema', 'deploy')

// ── 2. Import seed data ──────────────────────────────────────────────────────

heading('Import seed data')
sanity('dataset', 'import', 'seed/data.ndjson', dataset!, '--missing')

// ── 3. Deploy blueprint ──────────────────────────────────────────────────────
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

// ── 4. Run typegen ──────────────────────────────────────────────────────────

heading('Run typegen')
sanity('schema', 'extract')
sanity('typegen', 'generate')

// ── 5. Klaviyo API key ──────────────────────────────────────────────────────

heading('Klaviyo API key')

const klaviyoKey = prompt('Enter your Klaviyo API key (or press Enter to skip): ')

if (klaviyoKey) {
  const functions = ['import-klaviyo', 'on-promotion-approved']
  for (const fn of functions) {
    run('pnpm', ['exec', 'sanity', 'functions', 'env', 'add', fn, 'KLAVIYO_API_KEY', klaviyoKey], {
      cwd: rootDir,
    })
  }
  console.log('Set KLAVIYO_API_KEY on import-klaviyo and on-promotion-approved functions')

  // ── 6. Import lists & segments from Klaviyo ─────────────────────────────────
  // Trigger the import-klaviyo function by setting importState to "requested".

  heading('Import lists & segments from Klaviyo')

  await client
    .patch('klaviyoImport')
    .set({importState: 'requested'})
    .commit({tag: 'bootstrap.klaviyo.trigger'})
  console.log('Triggered Klaviyo import — lists and segments will sync in the background')
} else {
  console.log(
    'No key entered — set it later with:\n  npx sanity functions env add import-klaviyo KLAVIYO_API_KEY <key>\n  npx sanity functions env add on-promotion-approved KLAVIYO_API_KEY <key>',
  )
}

// ── 7. Install marker ───────────────────────────────────────────────────────

try {
  await client.fetch('true', {}, {tag: 'bootstrap.install'})
} catch {
  // best-effort — never block bootstrap
}

console.log('\n✓ Bootstrap complete\n')
