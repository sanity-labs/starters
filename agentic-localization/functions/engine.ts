/**
 * Shared construction for the runtime Functions. All four drive the same
 * engine and differ only in which verb they call.
 */

import type {ClientConfig, SanityClient} from '@sanity/client'
import type {
  DeclaredExecutionContext,
  EffectHandler,
  Engine,
  ResourceClientResolver,
} from '@sanity/workflow-engine'

import {createClient} from '@sanity/client'
import {createEngine, EXECUTION_KINDS} from '@sanity/workflow-engine'

const API_VERSION = '2025-05-16'

/** Above the 120s Function timeout, so a live dispatch never outlives its claim. */
const EFFECT_LEASE_MS = 150_000

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable ${name}`)
  }
  return value
}

/** The advisory "via what" stamped on every history entry this host writes. */
export function executionContext(name: string): DeclaredExecutionContext {
  return {kind: EXECUTION_KINDS.drainer, id: name}
}

/**
 * The engine reads and writes the workflows dataset only. Handlers route their
 * own content traffic through `ctx.clientFor`, which the engine derives from
 * these same credentials.
 */
export function workflowsClient(config: ClientConfig, name: string): SanityClient {
  return createClient({
    ...config,
    apiVersion: API_VERSION,
    useCdn: false,
    requestTagPrefix: `fn.l10n.${name}`,
  })
}

/**
 * Declare the project's other datasets.
 *
 * Content lives in the main dataset and the engine's store does not, so every
 * ref a run supplies at runtime — `startInstance`'s subject, an effect's
 * `field.set` of the document it just wrote — points outside the workflow
 * resource. The engine rejects a ref to a resource the deployment does not
 * declare (`RefResourceUndeclaredError`), and returning a client here IS the
 * declaration. The sibling returned is the one the engine's own router would
 * derive anyway; memoized because the engine caches identity per client object.
 *
 * The same shape `@sanity/workflow-studio` wires by default. Without it the
 * split-dataset deployment cannot start a run at all.
 */
function projectResourceClients(client: SanityClient): ResourceClientResolver {
  const {projectId} = client.config()
  const siblings = new Map<string, SanityClient>()

  return (parsed) => {
    if (parsed.scheme !== 'dataset' || parsed.projectId !== projectId || !parsed.dataset) {
      return undefined
    }
    const cached = siblings.get(parsed.dataset)
    if (cached) return cached
    const sibling = client.withConfig({dataset: parsed.dataset})
    siblings.set(parsed.dataset, sibling)
    return sibling
  }
}

/**
 * `effectHandlers` is a parameter, not a constant, because only the drainer
 * needs one. `tick` and `abortInstance` never reach a handler — proven in
 * `packages/l10n/src/workflows/effectDispatch.test.ts` — so the Functions that
 * only call those pass `{}` and keep `@starter/l10n/effects`, the Agent Actions
 * code paths and the whole prompt-assembly graph out of their bundles.
 */
export function localizationEngine(
  client: SanityClient,
  name: string,
  effectHandlers: Record<string, EffectHandler>,
): Engine {
  return createEngine({
    client,
    tag: requireEnv('WORKFLOW_TAG'),
    workflowResource: {type: 'dataset', id: requireEnv('WORKFLOWS_DATASET_ID')},
    resourceClients: projectResourceClients(client),
    effectHandlers,
    effectLeaseMs: EFFECT_LEASE_MS,
    // A definition can outlive the handler that satisfied it; skipping leaves
    // the effect claimable rather than failing the run.
    missingHandler: 'skip',
    executionContext: executionContext(name),
  })
}
