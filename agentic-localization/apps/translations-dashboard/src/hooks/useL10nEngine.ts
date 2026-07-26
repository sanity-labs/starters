/**
 * The one engine instance for the app.
 *
 * `@sanity/workflow-sdk` ships no engine hook: it takes an engine and observes
 * it through the App SDK document store, so the app builds it. The client must
 * address the workflows dataset — the engine routes its own reads and writes
 * through it and derives sibling clients for content resources from the same
 * credentials.
 */

import type {SanityClient} from '@sanity/client'
import type {CreateEngineArgs, Engine} from '@sanity/workflow-engine'

import {useClient} from '@sanity/sdk-react'
import {createEngine} from '@sanity/workflow-engine'
import {ENGINE_API_VERSION, projectResourceClients} from '@starter/l10n/workflows'
import {useMemo} from 'react'

import {WORKFLOW_TAG, WORKFLOWS_DATASET, WORKFLOWS_RESOURCE} from '../consts/workflows'

/**
 * Split out from the hook so the declared ref surface is assertable without a
 * renderer. `resourceClients` is what admits the content dataset to that
 * surface, and a campaign start — whose `release.ref` and `doc.refs` all point
 * into content — is refused outright without it.
 */
export function l10nEngineArgs(client: SanityClient): CreateEngineArgs<SanityClient> {
  return {
    client,
    tag: WORKFLOW_TAG,
    workflowResource: WORKFLOWS_RESOURCE,
    resourceClients: projectResourceClients(client),
  }
}

export function useL10nEngine(): Engine {
  const client = useClient({apiVersion: ENGINE_API_VERSION, dataset: WORKFLOWS_DATASET})

  return useMemo(() => createEngine(l10nEngineArgs(client)), [client])
}
