/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env — project ID + dataset into app/.env.local
 *  2. Prompt for Anthropic API key (chat harness)
 *  3. Prompt for organization ID + Context Viewer token (MCP auth)
 *  4. Add CORS origin for the local help center
 *  5. Deploy blueprint (set-review-date)
 *  6. Deploy schema (required for GROQ-mode MCP endpoints)
 *  7. Make the dataset private
 *  8. Enable Dataset Embeddings
 *  9. Create a project Viewer token for help-center reads
 * 10. Import seed data
 * 11. Restore dependencies
 * 12. Generate types
 *
 * Knowledge Bases and Context MCP endpoints are created in the Context app.
 * Bootstrap does not call those APIs. See the README after this finishes.
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

const client = getCliClient({apiVersion: '2025-03-01'})
const {projectId, dataset} = client.config()

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
  console.error(`  Failed: ${message}`)
  results.push({name, status: 'failed', error: message, manualCommand})
}

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

if (!projectId || !dataset) {
  console.error('\nCould not resolve project ID and dataset. Run `sanity init --template` first.\n')
  process.exit(1)
}

heading('Consolidate env')
try {
  if (!existsSync(appEnvLocal) && existsSync(appEnvExample)) {
    copyFileSync(appEnvExample, appEnvLocal)
    console.log('Created app/.env.local from app/.env.example')
  }
  patchEnvVar(appEnvLocal, 'NEXT_PUBLIC_SANITY_PROJECT_ID', projectId)
  patchEnvVar(appEnvLocal, 'NEXT_PUBLIC_SANITY_DATASET', dataset)
  console.log('Wrote project ID + dataset to app/.env.local')
  success('Consolidate env')
} catch (err) {
  failed('Consolidate env', err)
}

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
      console.log('No key entered — chat will not work until you add one')
    }
  }
  success('Anthropic API key')
} catch (err) {
  failed('Anthropic API key', err, 'Add ANTHROPIC_API_KEY=your-key to app/.env.local')
}

heading('Context organization credentials')
try {
  const appVars = parseEnvFile(appEnvLocal)
  if (!isRealValue(appVars.SANITY_ORGANIZATION_ID)) {
    const orgId = prompt(
      'Enter your Sanity organization ID (Manage → your org, or Enter to skip): ',
    )
    if (orgId) patchEnvVar(appEnvLocal, 'SANITY_ORGANIZATION_ID', orgId)
  } else {
    console.log('Organization ID already set')
  }
  if (!isRealValue(appVars.SANITY_ORGANIZATION_TOKEN)) {
    const orgToken = prompt(
      'Enter an organization API token with Context Viewer (Manage → API → Tokens, or Enter to skip): ',
    )
    if (orgToken) patchEnvVar(appEnvLocal, 'SANITY_ORGANIZATION_TOKEN', orgToken)
  } else {
    console.log('Organization token already set')
  }
  console.log(
    'MCP endpoint URLs are created in the Context app. Paste them into app/.env.local after the README setup.',
  )
  success('Context organization credentials')
} catch (err) {
  failed(
    'Context organization credentials',
    err,
    'Add SANITY_ORGANIZATION_ID and SANITY_ORGANIZATION_TOKEN to app/.env.local',
  )
}

heading('Add CORS origin')
try {
  execFileSync(
    'pnpm',
    ['exec', 'sanity', 'cors', 'add', 'http://localhost:3000', '--credentials'],
    {
      stdio: 'pipe',
    },
  )
  console.log('Added http://localhost:3000 as a CORS origin')
  success('Add CORS origin')
} catch (err) {
  const out = String(
    err instanceof Error ? `${err.message} ${(err as {stderr?: Buffer}).stderr ?? ''}` : err,
  ).toLowerCase()
  if (out.includes('duplicate') || out.includes('conflict')) {
    console.log('CORS origin already exists — skipping')
    success('Add CORS origin')
  } else {
    failed(
      'Add CORS origin',
      err,
      'cd studio && npx sanity cors add http://localhost:3000 --credentials',
    )
  }
}

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
    }
  }
  run('pnpm', ['exec', 'sanity', 'blueprints', 'deploy'], {cwd: root})
  success('Deploy blueprint')
} catch (err) {
  failed('Deploy blueprint', err, 'cd <root> && npx sanity blueprints deploy')
}

heading('Deploy schema')
try {
  sanity('schema', 'deploy')
  success('Deploy schema')
} catch (err) {
  failed('Deploy schema', err, 'cd studio && npx sanity schema deploy')
}

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

heading('Enable Dataset Embeddings')
const EMBEDDINGS_PROJECTION =
  '{title, question, summary, "content": pt::text(content), "answer": pt::text(answer), description}'
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

heading('Help center read token')
try {
  const appVars = parseEnvFile(appEnvLocal)
  if (isRealValue(appVars.SANITY_API_READ_TOKEN)) {
    console.log('Help center read token already set — skipping creation')
  } else {
    const out = execFileSync(
      'pnpm',
      [
        'exec',
        'sanity',
        'tokens',
        'add',
        'Knowledge Base — Help center (Viewer)',
        '--project-id',
        projectId,
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
    patchEnvVar(appEnvLocal, 'SANITY_API_READ_TOKEN', token)
    console.log('Created project Viewer token and wrote it to app/.env.local')
  }
  success('Help center read token')
} catch (err) {
  failed(
    'Help center read token',
    err,
    'cd studio && npx sanity tokens add "KB Help center" --role viewer  # then add SANITY_API_READ_TOKEN to app/.env.local',
  )
}

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

heading('Restore dependencies')
try {
  run('pnpm', ['install'], {cwd: root})
  success('Restore dependencies')
} catch (err) {
  failed('Restore dependencies', err, 'pnpm install')
}

heading('Generate types')
try {
  run('pnpm', ['--filter', 'studio', 'typegen'], {cwd: root})
  success('Generate types')
} catch (err) {
  failed('Generate types', err, 'pnpm typegen')
}

const failures = results.filter((r) => r.status === 'failed')
const skips = results.filter((r) => r.status === 'skipped')

console.log('\n' + '─'.repeat(64))
if (failures.length === 0) {
  console.log('\nBootstrap complete\n')
  console.log('Next: create the two Knowledge Bases and four MCP endpoints in the')
  console.log('Context app, then paste the endpoint URLs into app/.env.local.')
  console.log('The README walks through that product-side setup.\n')
} else {
  console.log('\nSome steps failed. To finish manually:\n')
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
