/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env files — ensure root .env has all values
 *  2. Resolve organization ID (not scaffolded by init)
 *  3. Deploy blueprint (CORS, dataset, robot token, functions)
 *  4. Deploy schema to the Content Lake
 *  5. Run typegen (schema extract + type generation)
 *  6. Seed locale documents via migration
 *  7. Import sample data (ndjson)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/)
 *   pnpm bootstrap          (from root — delegates here via --filter)
 */

import {execFileSync} from 'node:child_process'
import {copyFileSync, existsSync, readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const dir = import.meta.dirname
const studioEnv = resolve(dir, '../.env')
const rootEnv = resolve(dir, '../../.env')

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{cwd?: string}} [options]
 */
function run(cmd, args, options) {
  execFileSync(cmd, args, {stdio: 'inherit', ...options})
}

/** @param {string[]} args */
function sanity(...args) {
  run('pnpm', ['exec', 'sanity', ...args])
}

/** @param {string} label */
function heading(label) {
  console.log(`\n── ${label} ${'─'.repeat(60 - label.length)}`)
}

// ── 1. Consolidate env ───────────────────────────────────────────────────────
// `sanity init --template` writes studio/.env. Ensure root .env stays in sync
// so every workspace (dashboard, frontend, blueprint) reads the same values.

heading('Consolidate env')

// Precedence: studio/.env (written by `sanity init`) → root .env → root .env.example
// Case A: studio/.env exists, root .env missing  → seed from .env.example, merge studio values
// Case B: studio/.env exists, root .env exists    → merge studio values into root
// Case C: studio/.env missing, root .env exists   → nothing to do (contributor path)
// Case D: neither exists, .env.example exists     → seed from .env.example (values empty)
// Case E: nothing exists                          → fail early with guidance

const rootExample = resolve(dir, '../../.env.example')

/**
 * @param {string} path
 * @returns {Record<string, string>}
 */
function parseEnvFile(path) {
  /** @type {Record<string, string>} */
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) vars[match[1].trim()] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return vars
}

if (!existsSync(rootEnv)) {
  if (existsSync(rootExample)) {
    copyFileSync(rootExample, rootEnv)
    console.log('Created .env from .env.example')
  } else if (!existsSync(studioEnv)) {
    throw new Error(
      'No .env, .env.example, or studio/.env found. Run `sanity init --template` first.',
    )
  }
}

if (existsSync(studioEnv)) {
  const studioVars = parseEnvFile(studioEnv)

  let content = existsSync(rootEnv) ? readFileSync(rootEnv, 'utf8') : ''
  for (const [key, value] of Object.entries(studioVars)) {
    if (!value) continue
    const pattern = new RegExp(`^#?\\s*(${key})=.*$`, 'm')
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1="${value}"`)
    } else {
      content = content.trimEnd() + `\n${key}="${value}"\n`
    }
  }
  writeFileSync(rootEnv, content)
  console.log('Merged studio/.env values into .env')
} else {
  console.log('No studio/.env found — using existing root .env')
}

// ── 2. Resolve org ID ────────────────────────────────────────────────────────

heading('Resolve organization ID')

const client = getCliClient({apiVersion: '2025-01-01'})
const {projectId, dataset} = client.config()

/** @type {{organizationId?: string}} */
const project = await client.request({uri: `/projects/${projectId}`})

if (project.organizationId) {
  let patched = 0

  for (const envFile of [studioEnv, rootEnv]) {
    try {
      const content = readFileSync(envFile, 'utf8')
      const updated = content.replace(
        /^#\s*SANITY_STUDIO_ORGANIZATION_ID=.*$/m,
        `SANITY_STUDIO_ORGANIZATION_ID=${project.organizationId}`,
      )
      if (updated !== content) {
        writeFileSync(envFile, updated)
        patched++
      }
    } catch {
      // File may not exist yet
    }
  }

  console.log(
    `Resolved organization ID: ${project.organizationId} (patched ${patched} env file${patched === 1 ? '' : 's'})`,
  )
} else {
  console.log('No organization found for project — skipping')
}

// ── 3. Deploy blueprint ──────────────────────────────────────────────────────
// Build functions, init the stack (first run only), then deploy the blueprint
// (CORS origins, dataset config, robot token, serverless functions).
// Must run from the monorepo root where sanity.blueprint.ts lives.

heading('Deploy blueprint')

const root = resolve(dir, '../..')

run('pnpm', ['--filter', '@starter/functions', 'run', 'build'], {cwd: root})

const blueprintConfig = resolve(root, '.sanity/blueprint.config.json')
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
        projectId,
      ],
      {cwd: root, stdio: 'pipe'},
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
        projectId,
        '--stack',
        'production',
      ],
      {cwd: root},
    )
  }
}

run('pnpm', ['exec', 'sanity', 'blueprints', 'deploy'], {cwd: root})

// ── 4. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
sanity('schema', 'deploy')

// ── 5. Typegen ───────────────────────────────────────────────────────────────

heading('Typegen')
sanity('schema', 'extract')
sanity('typegen', 'generate')

// ── 6. Seed locales ──────────────────────────────────────────────────────────

heading('Seed locales')
sanity('migration', 'run', 'seed-locales', '--no-dry-run', '--no-confirm')

// ── 7. Import sample data ────────────────────────────────────────────────────

heading('Import sample data')
sanity('dataset', 'import', 'sample-data.ndjson', dataset, '--replace')

console.log('\n✓ Bootstrap complete\n')
