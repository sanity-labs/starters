/**
 * `@starter/l10n/credentials`
 *
 * How a suite that talks to a real project finds a token.
 *
 * Its own entry rather than a member of `.` or `./prompts`: `configstore` reads
 * the filesystem, and both of those entries are bundled into a Sanity Function
 * or a frontend. Consumed by the eval suite and by `e2e/`.
 */

import ConfigStore from 'configstore'

/**
 * Resolve a Sanity auth token for a suite running outside the CLI.
 *
 * `getCliClient` (from `sanity/cli`) only injects a token inside the Sanity CLI
 * process (e.g. `sanity exec --with-user-token`); under vitest
 * `__internal__getToken` returns undefined.
 *
 * Mirrors the CLI's own resolution (configClient.ts in sanity-io/sanity):
 *  1. SANITY_AUTH_TOKEN (CI / explicit override)
 *  2. ConfigStore('sanity').get('authToken') — a local `sanity login` session
 */
export function getUserToken(): string | undefined {
  if (process.env.SANITY_AUTH_TOKEN) return process.env.SANITY_AUTH_TOKEN

  try {
    const config = new ConfigStore('sanity', {}, {globalConfigPath: true})
    return config.get('authToken')
  } catch {
    return undefined
  }
}
