/**
 * Where the suite runs and who it runs as.
 *
 * Isolation is a dedicated dataset pair, not a namespace inside `production`:
 * the engine's guards are real Content Lake mutation guards and its instances
 * are real documents, so a run that dies mid-flight leaves a publish lock on a
 * document. A throwaway dataset makes that a non-event.
 */

import {getUserToken} from '@starter/l10n/credentials'

/** Content documents — articles, people, locales. */
export const CONTENT_DATASET = process.env.SANITY_E2E_CONTENT_DATASET ?? 'e2e'

/** Engine storage — definitions, instances. */
export const WORKFLOWS_DATASET = process.env.SANITY_E2E_WORKFLOWS_DATASET ?? 'workflows-e2e'

/** The dated API every content read and write in the suite runs against. */
export const API_VERSION = '2025-05-16'

/** Reusable fixtures, shared by every run and never swept. */
export const FIXTURE_PREFIX = 'e2e-fixture-'

/** Per-run documents. Swept by id prefix when the run ends, and by age before it starts. */
export const RUN_PREFIX = 'e2e-run-'

/** How long a previous run's litter is left alone before the sweep claims it. */
export const RETENTION_MS = 2 * 60 * 60 * 1000

export interface E2eCredentials {
  projectId: string
  token: string
}

/**
 * Resolve the project and token, or explain exactly what is missing. Called
 * from `globalSetup` so the failure names the env vars instead of surfacing as
 * a 401 inside the first journey.
 */
export function assertE2eCredentials(): E2eCredentials {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const token = getUserToken()

  if (!projectId || !token) {
    const missing = [
      projectId ? undefined : 'SANITY_STUDIO_PROJECT_ID',
      token ? undefined : 'SANITY_AUTH_TOKEN',
    ].filter((name) => name !== undefined)

    throw new Error(
      `[e2e] Missing credentials: ${missing.join(', ')}.\n` +
        'The suite drives a real project: real datasets, the real engine, real guards.\n' +
        '  - SANITY_STUDIO_PROJECT_ID: the starter root .env\n' +
        '  - SANITY_AUTH_TOKEN: e2e/.env (gitignored), or run `sanity login` and its\n' +
        '    session token is used as a fallback. The token needs dataset-create rights\n' +
        `    unless ${CONTENT_DATASET} and ${WORKFLOWS_DATASET} already exist.`,
    )
  }

  return {projectId, token}
}

/** `dataset:<projectId>.<dataset>` — the engine's `workflowResource` id form. */
export function resourceId(projectId: string, dataset: string): string {
  return `${projectId}.${dataset}`
}
