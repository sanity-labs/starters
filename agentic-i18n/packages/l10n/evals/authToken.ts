import ConfigStore from 'configstore'

/**
 * Resolve a Sanity auth token for eval scripts.
 *
 * getCliClient (from sanity/cli) only injects a token when running inside the
 * Sanity CLI process (e.g. `sanity exec --with-user-token`). Outside that
 * context — like vitest — `__internal__getToken` returns undefined.
 *
 * This mirrors the CLI's own token resolution (see configClient.ts in sanity-io/sanity):
 *  1. SANITY_AUTH_TOKEN env var (CI / explicit override)
 *  2. ConfigStore('sanity').get('authToken') (local `sanity login` session)
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
