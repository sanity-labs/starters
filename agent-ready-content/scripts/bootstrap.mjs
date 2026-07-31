#!/usr/bin/env node
/**
 * Bootstrap the agent-ready-content starter.
 *
 * 1. Reads SANITY_PROJECT_ID from .env (or prompts for it)
 * 2. Writes per-app env files
 * 3. Deploys the schema
 * 4. Generates TypeScript types (gitignored, needed for typecheck)
 * 5. Imports seed content into the dataset
 * 6. Adds CORS origins for the Next.js and Astro dev servers
 *
 * Prerequisites: `pnpm install` has run, and you are logged in to the
 * Sanity CLI (`pnpm dlx sanity login`). See docs/manual-setup.md for
 * the manual equivalent of every step.
 */
import {execSync} from 'node:child_process'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {createInterface} from 'node:readline/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const studioDir = path.join(root, 'studio')

function readEnvFile(file) {
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
}

function run(command, options = {}) {
  console.log(`\n$ ${command}`)
  execSync(command, {stdio: 'inherit', ...options})
}

const env = {...readEnvFile(path.join(root, '.env')), ...process.env}

let projectId = env.SANITY_PROJECT_ID
const dataset = env.SANITY_DATASET || 'production'

if (!projectId) {
  const rl = createInterface({input: process.stdin, output: process.stdout})
  projectId = (
    await rl.question(
      'Sanity project ID (create one at sanity.io/manage or with `pnpm dlx sanity projects create`): ',
    )
  ).trim()
  rl.close()
}

if (!projectId) {
  console.error('A project ID is required. Aborting.')
  process.exit(1)
}

const studioEnv = {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset}

// 1. Per-app env files
writeFileSync(
  path.join(studioDir, '.env'),
  `SANITY_STUDIO_PROJECT_ID=${projectId}\nSANITY_STUDIO_DATASET=${dataset}\n`,
)
writeFileSync(
  path.join(root, 'apps', 'next', '.env.local'),
  [
    `NEXT_PUBLIC_SANITY_PROJECT_ID=${projectId}`,
    `NEXT_PUBLIC_SANITY_DATASET=${dataset}`,
    `NEXT_PUBLIC_SITE_URL=${env.NEXT_SITE_URL || 'http://localhost:3000'}`,
    '',
  ].join('\n'),
)
writeFileSync(
  path.join(root, 'apps', 'astro', '.env'),
  [
    `SANITY_PROJECT_ID=${projectId}`,
    `SANITY_DATASET=${dataset}`,
    `SITE_URL=${env.ASTRO_SITE_URL || 'http://localhost:4321'}`,
    '',
  ].join('\n'),
)
console.log('Wrote studio/.env, apps/next/.env.local, apps/astro/.env')

const studioExec = {cwd: studioDir, env: {...process.env, ...studioEnv}}

// 2. Dataset (create is idempotent-ish: ignore "already exists")
try {
  run(`pnpm exec sanity dataset create ${dataset} --visibility public`, studioExec)
} catch {
  console.log(`Dataset "${dataset}" already exists, continuing.`)
}

// 3. Schema deploy
run('pnpm exec sanity schema deploy', studioExec)

// 4. TypeGen (schema.json and sanity.types.ts are gitignored)
run('pnpm run typegen', studioExec)

// 5. Seed content
run(`pnpm exec sanity dataset import ../seed/seed.ndjson ${dataset} --missing`, studioExec)

// 6. CORS for both dev servers
for (const origin of ['http://localhost:3000', 'http://localhost:4321']) {
  try {
    run(`pnpm exec sanity cors add ${origin} --no-credentials`, studioExec)
  } catch {
    console.log(`CORS origin ${origin} already configured, continuing.`)
  }
}

console.log(`
Bootstrap complete.

  pnpm dev

  Studio   http://localhost:3333
  Next.js  http://localhost:3000
  Astro    http://localhost:4321

Try the three access patterns:

  curl http://localhost:3000/docs/getting-started/quickstart.md
  curl -H "Accept: text/markdown" http://localhost:3000/docs/getting-started/quickstart
  curl http://localhost:3000/llms.txt
`)
