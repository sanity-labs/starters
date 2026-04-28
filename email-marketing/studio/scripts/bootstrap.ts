/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Deploy schema to the Content Lake
 *  2. Import seed data (ndjson)
 *  3. Deploy blueprint (functions)
 *  4. Run typegen (schema extract + type generation)
 *  5. Prompt for Resend API key + from-address (optional)
 *  6. Trigger Resend segment import (if key was provided)
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

const client = getCliClient({apiVersion: '2026-04-08'})
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

// ── 5. Resend API key + from-address ────────────────────────────────────────

heading('Resend API key')

const resendKey = prompt('Enter your Resend API key (re_…) (or press Enter to skip): ')

if (resendKey) {
  const functions = ['import-resend-segments', 'on-promotion-approved']
  for (const fn of functions) {
    run('pnpm', ['exec', 'sanity', 'functions', 'env', 'add', fn, 'RESEND_API_KEY', resendKey], {
      cwd: rootDir,
    })
  }
  console.log('Set RESEND_API_KEY on import-resend-segments and on-promotion-approved functions')

  const fromEmail = prompt(
    'Enter your verified Resend from-address (e.g. "Brand <updates@example.com>") (or press Enter to skip): ',
  )

  if (fromEmail) {
    run(
      'pnpm',
      [
        'exec',
        'sanity',
        'functions',
        'env',
        'add',
        'on-promotion-approved',
        'RESEND_FROM_EMAIL',
        fromEmail,
      ],
      {cwd: rootDir},
    )
    console.log('Set RESEND_FROM_EMAIL on on-promotion-approved')
  } else {
    console.log(
      'No from-address entered — set it later with:\n  npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"',
    )
  }

  // ── 6. Import segments from Resend ──────────────────────────────────────────
  // Trigger the import-resend-segments function by setting importState to "requested".

  heading('Import segments from Resend')

  await client.patch('espImport').set({importState: 'requested'}).commit()
  console.log('Triggered Resend segment import — segments will sync in the background')
} else {
  console.log(
    'No key entered — set it later with:\n  npx sanity functions env add import-resend-segments RESEND_API_KEY <key>\n  npx sanity functions env add on-promotion-approved RESEND_API_KEY <key>\n  npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"',
  )
}

console.log('\n✓ Bootstrap complete\n')
