/**
 * The three clients the suite needs: one per dataset, plus a project-scoped one
 * for the datasets API.
 */

import type {SanityClient} from '@sanity/client'

import {createClient} from '@sanity/client'

import {API_VERSION, assertE2eCredentials, CONTENT_DATASET, WORKFLOWS_DATASET} from './env'

function client(dataset: string, tagPrefix: string): SanityClient {
  const {projectId, token} = assertE2eCredentials()
  return createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
    requestTagPrefix: `e2e.${tagPrefix}`,
  })
}

/** Fixtures, assertions, and the resource the effect handlers write into. */
export function contentClient(): SanityClient {
  return client(CONTENT_DATASET, 'content')
}

/** Engine storage — instances, definitions, the tag partition. */
export function workflowsClient(): SanityClient {
  return client(WORKFLOWS_DATASET, 'workflows')
}

/**
 * `client.datasets` addresses the project API, so the configured dataset is
 * never requested — it only satisfies the constructor while the dataset this
 * client is about to create may not exist yet.
 */
export function projectClient(): SanityClient {
  return client(CONTENT_DATASET, 'project')
}
