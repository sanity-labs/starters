/**
 * Run a scheduled Sanity Function locally against the root `.env`.
 *
 * `sanity functions test` runs the bundle in isolation: it doesn't receive the
 * projectId/dataset the blueprint injects on deploy, nor a token — so the
 * function's own config guard fails with "Missing Sanity client configuration".
 * This wrapper loads the root `.env` (projectId + dataset) into the environment
 * and passes `--with-user-token`, so `pnpm fn:triage` / `pnpm fn:sync` just work.
 *
 * Usage: tsx scripts/fn.ts <function-name> [extra sanity flags]
 */
import 'dotenv/config'
import {execFileSync} from 'node:child_process'

const [name, ...rest] = process.argv.slice(2)

if (!name) {
  console.error('Usage: tsx scripts/fn.ts <function-name>  (e.g. agent-triage, analytics-sync)')
  process.exit(1)
}

execFileSync('sanity', ['functions', 'test', name, '--with-user-token', ...rest], {
  stdio: 'inherit',
})
