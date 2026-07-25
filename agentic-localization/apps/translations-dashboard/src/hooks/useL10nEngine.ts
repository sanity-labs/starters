/**
 * The one engine instance for the app.
 *
 * `@sanity/workflow-sdk` ships no engine hook: it takes an engine and observes
 * it through the App SDK document store, so the app builds it. The client must
 * address the workflows dataset — the engine routes its own reads and writes
 * through it and derives sibling clients for content resources from the same
 * credentials.
 */

import type {Engine} from '@sanity/workflow-engine'

import {useClient} from '@sanity/sdk-react'
import {createEngine} from '@sanity/workflow-engine'
import {useMemo} from 'react'

import {WORKFLOW_TAG, WORKFLOWS_DATASET, WORKFLOWS_RESOURCE} from '../consts/workflows'

const ENGINE_API_VERSION = '2026-07-01'

export function useL10nEngine(): Engine {
  const client = useClient({apiVersion: ENGINE_API_VERSION, dataset: WORKFLOWS_DATASET})

  return useMemo(
    () =>
      createEngine({
        client,
        tag: WORKFLOW_TAG,
        workflowResource: WORKFLOWS_RESOURCE,
      }),
    [client],
  )
}
