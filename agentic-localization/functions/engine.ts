/**
 * Shared construction for the runtime Functions. All four drive the same
 * engine and differ only in which verb they call.
 */

import type {ClientConfig, SanityClient} from '@sanity/client'
import type {DeclaredExecutionContext, Engine} from '@sanity/workflow-engine'

import {createClient} from '@sanity/client'
import {createEngine, EXECUTION_KINDS} from '@sanity/workflow-engine'
import {localizationEffectHandlers} from '@starter/l10n/handlers'

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

export function localizationEngine(client: SanityClient, name: string): Engine {
  return createEngine({
    client,
    tag: requireEnv('WORKFLOW_TAG'),
    workflowResource: {type: 'dataset', id: requireEnv('WORKFLOWS_DATASET_ID')},
    effectHandlers: localizationEffectHandlers,
    effectLeaseMs: EFFECT_LEASE_MS,
    // A definition can outlive the handler that satisfied it; skipping leaves
    // the effect claimable rather than failing the run.
    missingHandler: 'skip',
    executionContext: executionContext(name),
  })
}
