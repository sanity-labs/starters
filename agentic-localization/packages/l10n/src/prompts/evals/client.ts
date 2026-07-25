import {createClient} from '@sanity/client'
import {getUserToken} from '../../credentials'

/**
 * Resolve the credentials the eval suite runs on, or explain what is missing.
 *
 * Project id and dataset come from the repo root `.env` (vitest `envDir`).
 * The auth token comes from `packages/l10n/.env` (gitignored — copy
 * `.env.example`) or from a local `sanity login` session.
 */
export function assertEvalCredentials(): {projectId: string; dataset: string; token: string} {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_STUDIO_DATASET
  const token = getUserToken()

  if (!projectId || !dataset || !token) {
    const missing = [
      projectId ? undefined : 'SANITY_STUDIO_PROJECT_ID',
      dataset ? undefined : 'SANITY_STUDIO_DATASET',
      token ? undefined : 'SANITY_AUTH_TOKEN',
    ].filter((name) => name !== undefined)

    throw new Error(
      `[eval] Missing credentials: ${missing.join(', ')}.\n` +
        'The eval suite calls live Agent Actions, so it needs a real project and a token.\n' +
        '  - SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET: repo root .env\n' +
        '  - SANITY_AUTH_TOKEN: packages/l10n/.env (gitignored; copy packages/l10n/.env.example)\n' +
        '    or run `sanity login`, whose session token is used as a fallback.',
    )
  }

  return {projectId, dataset, token}
}

export function getClient() {
  const {projectId, dataset, token} = assertEvalCredentials()

  return createClient({
    projectId,
    dataset,
    apiVersion: 'vX',
    token,
    useCdn: false,
    requestTagPrefix: 'evals.agentic-l10n',
  })
}
