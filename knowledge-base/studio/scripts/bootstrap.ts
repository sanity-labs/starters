/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env — propagate project ID + dataset to app/.env.local
 *  2. Prompt for Anthropic API key (powers the chat surfaces)
 *  3. Add CORS origin for the local help center (localhost:3000)
 *  4. Deploy blueprint (the set-review-date function + robot token)
 *  5. Deploy schema to the Content Lake
 *  6. Deploy Studio — required for the Agent Context MCP endpoint to exist
 *  7. Make the dataset private (security model: no API access without a token)
 *  8. Enable Dataset Embeddings (powers hybrid semantic retrieval)
 *  9. Create the external + internal read tokens and write their Agent Context MCP URLs
 * 10. Import seed data (ndjson)
 * 11. Restore dependencies (blueprint deploy can disrupt node_modules)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/, runs via `sanity exec --with-user-token`)
 */

import {execFileSync} from 'node:child_process'
import {copyFileSync, existsSync, readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const dir = import.meta.dirname!
const root = resolve(dir, '../..')
const appEnvLocal = resolve(root, 'app/.env.local')
const appEnvExample = resolve(root, 'app/.env.example')
const dashboardEnvLocal = resolve(root, 'dashboard/.env.local')
const dashboardEnvExample = resolve(root, 'dashboard/.env.example')
const serverEnvLocal = resolve(root, 'dashboard-server/.env.local')
const serverEnvExample = resolve(root, 'dashboard-server/.env.example')

// MCP endpoint API version. Confirm against the URL shown in the Studio Agent
// Context panel after deploy — adjust here if Sanity has bumped it.
const MCP_API_VERSION = 'v2025-03-01'

const client = getCliClient({apiVersion: '2025-03-01'})
const {projectId, dataset} = client.config()

// ── Step runner ───────────────────────────────────────────────────────────

interface StepResult {
  name: string
  status: 'success' | 'skipped' | 'failed'
  error?: string
  manualCommand?: string
}

const results: StepResult[] = []
const success = (name: string) => results.push({name, status: 'success'})
const failed = (name: string, error: unknown, manualCommand?: string) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`  ✗ Failed: ${message}`)
  results.push({name, status: 'failed', error: message, manualCommand})
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], options?: {cwd?: string}) {
  execFileSync(cmd, args, {stdio: 'inherit', ...options})
}

function sanity(...args: string[]) {
  run('pnpm', ['exec', 'sanity', ...args])
}

function heading(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`)
}

function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {}
  if (!existsSync(path)) return vars
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) vars[match[1].trim()] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return vars
}

function patchEnvVar(filePath: string, key: string, value: string) {
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const pattern = new RegExp(`^#?\\s*(${key})=.*$`, 'm')
  if (pattern.test(content)) {
    content = content.replace(pattern, `${key}=${value}`)
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`
  }
  writeFileSync(filePath, content.replace(/^\n/, ''))
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

const isRealValue = (value: string | undefined): boolean =>
  !!value && !value.toLowerCase().startsWith('your-')

const mcpUrl = (slug: string) =>
  `https://api.sanity.io/${MCP_API_VERSION}/agent-context/${projectId}/${dataset}/${slug}`

if (!projectId || !dataset) {
  console.error(
    '\n✗ Could not resolve project ID and dataset. Run `sanity init --template` first.\n',
  )
  process.exit(1)
}

// ── 1. Consolidate env ───────────────────────────────────────────────────────

heading('Consolidate env')
try {
  if (!existsSync(appEnvLocal) && existsSync(appEnvExample)) {
    copyFileSync(appEnvExample, appEnvLocal)
    console.log('Created app/.env.local from app/.env.example')
  }
  patchEnvVar(appEnvLocal, 'NEXT_PUBLIC_SANITY_PROJECT_ID', projectId)
  patchEnvVar(appEnvLocal, 'NEXT_PUBLIC_SANITY_DATASET', dataset)

  // Internal surface: App SDK dashboard + its chat proxy.
  if (!existsSync(dashboardEnvLocal) && existsSync(dashboardEnvExample)) {
    copyFileSync(dashboardEnvExample, dashboardEnvLocal)
  }
  patchEnvVar(dashboardEnvLocal, 'SANITY_APP_PROJECT_ID', projectId)
  patchEnvVar(dashboardEnvLocal, 'SANITY_APP_DATASET', dataset)
  if (!existsSync(serverEnvLocal) && existsSync(serverEnvExample)) {
    copyFileSync(serverEnvExample, serverEnvLocal)
  }
  console.log('Wrote project ID + dataset to app, dashboard, and dashboard-server env')
  success('Consolidate env')
} catch (err) {
  failed('Consolidate env', err)
}

// ── 2. Anthropic API key ─────────────────────────────────────────────────────

heading('Anthropic API key')
let anthropicKey = parseEnvFile(appEnvLocal).ANTHROPIC_API_KEY
try {
  if (isRealValue(anthropicKey)) {
    console.log('Anthropic API key already configured')
  } else {
    anthropicKey = prompt(
      'Enter your Anthropic API key (https://console.anthropic.com, or Enter to skip): ',
    )
    if (anthropicKey) {
      patchEnvVar(appEnvLocal, 'ANTHROPIC_API_KEY', anthropicKey)
      console.log('Saved Anthropic API key to app/.env.local')
    } else {
      console.log('No key entered — the chat surfaces will not work until you add one')
    }
  }
  // The internal chat proxy needs the key too.
  if (isRealValue(anthropicKey)) patchEnvVar(serverEnvLocal, 'ANTHROPIC_API_KEY', anthropicKey)
  success('Anthropic API key')
} catch (err) {
  failed('Anthropic API key', err, 'Add ANTHROPIC_API_KEY=your-key to app/.env.local')
}

// ── 3. Add CORS origin ───────────────────────────────────────────────────────

heading('Add CORS origin')
try {
  sanity('cors', 'add', 'http://localhost:3000', '--credentials')
  success('Add CORS origin')
} catch (err) {
  failed(
    'Add CORS origin',
    err,
    'cd studio && npx sanity cors add http://localhost:3000 --credentials',
  )
}

// ── 4. Deploy blueprint ──────────────────────────────────────────────────────

heading('Deploy blueprint')
try {
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
    } catch (initErr: unknown) {
      const out = String(initErr instanceof Error ? initErr.message : initErr).toLowerCase()
      if (!out.includes('already exists')) throw initErr
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
  success('Deploy blueprint')
} catch (err) {
  failed('Deploy blueprint', err, 'cd <root> && npx sanity blueprints deploy')
}

// ── 5. Deploy schema ─────────────────────────────────────────────────────────

heading('Deploy schema')
try {
  sanity('schema', 'deploy')
  success('Deploy schema')
} catch (err) {
  failed('Deploy schema', err, 'cd studio && npx sanity schema deploy')
}

// ── 6. Deploy Studio ─────────────────────────────────────────────────────────
// Required: the Agent Context MCP endpoint only exists for a deployed Studio.

heading('Deploy Studio')
try {
  sanity('deploy')
  success('Deploy Studio')
} catch (err) {
  failed('Deploy Studio', err, 'cd studio && npx sanity deploy')
}

// ── 7. Make dataset private ──────────────────────────────────────────────────
// The GROQ filter is a governance mechanism, not a security boundary — it only
// holds if API access is gated on a server-side token the client never sees.

heading('Make dataset private')
try {
  sanity('datasets', 'visibility', 'set', dataset, 'private')
  success('Make dataset private')
} catch (err) {
  failed(
    'Make dataset private',
    err,
    `cd studio && npx sanity datasets visibility set ${dataset} private`,
  )
}

// ── 8. Enable Dataset Embeddings ─────────────────────────────────────────────
// Powers text::semanticSimilarity(). Project to the text that matters; pt::text
// keeps Portable Text bodies clean (no HTML noise) in the embedding.

heading('Enable Dataset Embeddings')
const EMBEDDINGS_PROJECTION =
  '{title, question, summary, "content": pt::text(content), "answer": pt::text(answer)}'
try {
  sanity('datasets', 'embeddings', 'enable', dataset, '--projection', EMBEDDINGS_PROJECTION)
  success('Enable Dataset Embeddings')
} catch (err) {
  failed(
    'Enable Dataset Embeddings',
    err,
    `cd studio && npx sanity datasets embeddings enable ${dataset} --projection '${EMBEDDINGS_PROJECTION}'`,
  )
}

// ── 9. External read token + MCP URL ─────────────────────────────────────────
// A Viewer token, used server-side by the help center to call its Agent Context
// MCP endpoint. Never exposed to the browser. The external/internal boundary is
// the MCP slug (customer-support) + groqFilter, not the token's role.

heading('External read token')
try {
  const appVars = parseEnvFile(appEnvLocal)
  if (isRealValue(appVars.SANITY_READ_TOKEN_EXTERNAL)) {
    console.log('External read token already set — skipping creation')
  } else {
    const out = execFileSync(
      'pnpm',
      [
        'exec',
        'sanity',
        'tokens',
        'add',
        'Knowledge Base — External (Surface 1)',
        '--role',
        'viewer',
        '--json',
        '-y',
      ],
      {cwd: root, stdio: ['inherit', 'pipe', 'inherit']},
    ).toString()
    const json = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    const token = json.key ?? json.token ?? json.value
    if (!token) throw new Error('Could not parse token from `sanity tokens add` output')
    patchEnvVar(appEnvLocal, 'SANITY_READ_TOKEN_EXTERNAL', token)
    console.log('Created external read token and wrote it to app/.env.local')
  }
  patchEnvVar(appEnvLocal, 'SANITY_AGENT_CONTEXT_URL', mcpUrl('customer-support'))
  console.log(`External Agent Context MCP URL: ${mcpUrl('customer-support')}`)
  console.log('  (verify this URL against the Agent Context panel in Studio)')
  success('External read token')
} catch (err) {
  failed(
    'External read token',
    err,
    'cd studio && npx sanity tokens add "KB External" --role viewer  # then add SANITY_READ_TOKEN_EXTERNAL to app/.env.local',
  )
}

// ── 9b. Internal read token + MCP URL ────────────────────────────────────────
// A separate Viewer token for the internal surface's chat proxy (dashboard-server).
// Points at the "team-kb" Agent Context, which is scoped to all content types.

heading('Internal read token')
try {
  if (isRealValue(parseEnvFile(serverEnvLocal).SANITY_READ_TOKEN_INTERNAL)) {
    console.log('Internal read token already set — skipping creation')
  } else {
    const out = execFileSync(
      'pnpm',
      [
        'exec',
        'sanity',
        'tokens',
        'add',
        'Knowledge Base — Internal (Surface 2)',
        '--role',
        'viewer',
        '--json',
        '-y',
      ],
      {cwd: root, stdio: ['inherit', 'pipe', 'inherit']},
    ).toString()
    const json = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    const token = json.key ?? json.token ?? json.value
    if (!token) throw new Error('Could not parse token from `sanity tokens add` output')
    patchEnvVar(serverEnvLocal, 'SANITY_READ_TOKEN_INTERNAL', token)
    console.log('Created internal read token and wrote it to dashboard-server/.env.local')
  }
  patchEnvVar(serverEnvLocal, 'SANITY_AGENT_CONTEXT_URL_INTERNAL', mcpUrl('team-kb'))
  success('Internal read token')
} catch (err) {
  failed(
    'Internal read token',
    err,
    'cd studio && npx sanity tokens add "KB Internal" --role viewer  # then add SANITY_READ_TOKEN_INTERNAL to dashboard-server/.env.local',
  )
}

// ── 10. Import seed data ─────────────────────────────────────────────────────

heading('Import seed data')
try {
  sanity('dataset', 'import', 'seed/data.ndjson', dataset, '--missing')
  success('Import seed data')
} catch (err) {
  failed(
    'Import seed data',
    err,
    `cd studio && npx sanity dataset import seed/data.ndjson ${dataset} --missing`,
  )
}

// ── 11. Restore dependencies ─────────────────────────────────────────────────

heading('Restore dependencies')
try {
  run('pnpm', ['install'], {cwd: root})
  success('Restore dependencies')
} catch (err) {
  failed('Restore dependencies', err, 'pnpm install')
}

// ── Summary ──────────────────────────────────────────────────────────────────

const failures = results.filter((r) => r.status === 'failed')
const skips = results.filter((r) => r.status === 'skipped')

console.log('\n' + '─'.repeat(64))
if (failures.length === 0) {
  console.log('\n✓ Bootstrap complete\n')
} else {
  console.log('\n⚠ Some steps failed. To finish manually:\n')
  for (const r of failures) {
    console.log(`  ${r.name}:`)
    if (r.manualCommand) console.log(`    $ ${r.manualCommand}`)
    console.log(`    Error: ${r.error}\n`)
  }
}
if (skips.length) {
  console.log('Skipped:')
  for (const r of skips) console.log(`  ${r.name}: ${r.error}`)
  console.log()
}
