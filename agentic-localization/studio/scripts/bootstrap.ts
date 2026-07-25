/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env files — ensure root .env has all values
 *  2. Resolve organization ID (not scaffolded by init)
 *  3. Deploy blueprint (CORS, datasets, robot token, Functions)
 *  4. Deploy workflow definitions
 *  5. Deploy schema to the Content Lake
 *  6. Run typegen (schema extract + type generation)
 *  7. Seed locale documents via migration
 *  8. Import sample data (ndjson)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/)
 *   pnpm bootstrap          (from root — delegates here via --filter)
 */

import {execFileSync} from 'node:child_process'
import {copyFileSync, existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {parseEnv} from 'node:util'
import {getCliClient} from 'sanity/cli'

const dir = import.meta.dirname!
const studioEnv = resolve(dir, '../.env')
const rootEnv = resolve(dir, '../../.env')

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], options?: {cwd?: string}) {
  execFileSync(cmd, args, {stdio: 'inherit', ...options})
}

function sanity(...args: string[]) {
  run('pnpm', ['exec', 'sanity', ...args])
}

function heading(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(60 - label.length)}`)
}

// ── 1. Consolidate env ───────────────────────────────────────────────────────
// `sanity init --template` writes studio/.env. Merge it into the root .env and
// delete it, so every workspace (dashboard, frontend, blueprint) reads one file.
// Two files is a split brain: `sanity.cli.ts` loads studio/.env at highest
// precedence while its Vite `envDir` points at the root, so an edit to one is
// invisible to half the stack.

heading('Consolidate env')

// Precedence: studio/.env (written by `sanity init`) → root .env → root .env.example
// Case A: studio/.env exists, root .env missing  → seed from .env.example, merge studio values
// Case B: studio/.env exists, root .env exists    → merge studio values into root
// Case C: studio/.env missing, root .env exists   → nothing to do (contributor path)
// Case D: neither exists, .env.example exists     → seed from .env.example (values empty)
// Case E: nothing exists                          → fail early with guidance

const rootExample = resolve(dir, '../../.env.example')

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
  const studioVars = parseEnv(readFileSync(studioEnv, 'utf8'))

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
  rmSync(studioEnv, {force: true})
  console.log('Merged studio/.env values into .env and removed studio/.env')
} else {
  console.log('No studio/.env found — using existing root .env')
}

// ── 2. Resolve org ID ────────────────────────────────────────────────────────

heading('Resolve organization ID')

let client = getCliClient({apiVersion: '2025-01-01'})
client = client.withConfig({requestTagPrefix: `${client.config().requestTagPrefix}.agentic-l10n`})
const {projectId, dataset} = client.config()

const project = await client.request<{organizationId?: string}>({
  uri: `/projects/${projectId}`,
  tag: 'get-project',
})

if (project.organizationId) {
  const content = readFileSync(rootEnv, 'utf8')
  const updated = content.replace(
    /^#\s*SANITY_STUDIO_ORGANIZATION_ID=.*$/m,
    `SANITY_STUDIO_ORGANIZATION_ID=${project.organizationId}`,
  )
  if (updated !== content) writeFileSync(rootEnv, updated)

  console.log(`Resolved organization ID: ${project.organizationId}`)
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
        projectId!,
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
        projectId!,
        '--stack',
        'production',
      ],
      {cwd: root},
    )
  }
}

run('pnpm', ['exec', 'sanity', 'blueprints', 'deploy'], {cwd: root})

// ── 4. Deploy workflow definitions ───────────────────────────────────────────
// Into the `workflows` dataset the blueprint just created. Deploys are
// idempotent; config lives in sanity.workflow.ts at the monorepo root.

heading('Deploy workflow definitions')
run('pnpm', ['exec', 'sanity-workflows', 'deploy'], {cwd: root})

// ── 5. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
sanity('schema', 'deploy')

// ── 6. Typegen ───────────────────────────────────────────────────────────────

heading('Typegen')
sanity('schema', 'extract')
sanity('typegen', 'generate')

// ── 7. Seed locales ──────────────────────────────────────────────────────────

heading('Seed locales')
sanity('migration', 'run', 'seed-locales', '--no-dry-run', '--no-confirm')

// ── 8. Import sample data ────────────────────────────────────────────────────

heading('Import sample data')
sanity('dataset', 'import', 'sample-data.ndjson', dataset!, '--replace')

// ── 9. Install marker ────────────────────────────────────────────────────────

try {
  await client.fetch('true', {}, {tag: 'bootstrap.install'})
} catch {
  // best-effort — never block bootstrap
}

console.log('\n✓ Bootstrap complete\n')
