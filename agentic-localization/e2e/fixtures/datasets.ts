/**
 * Provision the dataset pair, or explain what a human has to do instead.
 *
 * A token that can write documents cannot necessarily create datasets, so
 * creation is attempted and a permission failure degrades to an existence
 * assertion rather than failing the run for the wrong reason.
 */

import {isHttpError} from '@sanity/client'

import {projectClient} from './clients'
import {CONTENT_DATASET, WORKFLOWS_DATASET} from './env'

const DATASETS = [CONTENT_DATASET, WORKFLOWS_DATASET]

export async function ensureDatasets(): Promise<void> {
  const client = projectClient()
  const existing = new Set((await client.datasets.list()).map((dataset) => dataset.name))

  for (const name of DATASETS.filter((name) => !existing.has(name))) {
    try {
      await client.datasets.create(name, {aclMode: 'private'})
      console.log(`[e2e] created dataset "${name}"`)
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      throw new Error(
        `[e2e] Dataset "${name}" does not exist and this token may not create one.\n` +
          `Create it once, then re-run:\n` +
          `  npx sanity dataset create ${name} --visibility private\n` +
          `Or point the suite at datasets you already have:\n` +
          `  SANITY_E2E_CONTENT_DATASET / SANITY_E2E_WORKFLOWS_DATASET`,
        {cause: error},
      )
    }
  }
}

function isPermissionDenied(error: unknown): boolean {
  return isHttpError(error) && (error.statusCode === 401 || error.statusCode === 403)
}
