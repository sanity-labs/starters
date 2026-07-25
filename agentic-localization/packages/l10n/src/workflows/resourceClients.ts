/**
 * Declaring the project's other datasets to an engine.
 *
 * Engine state lives in the workflows dataset and content does not, so every
 * ref a caller supplies at runtime — `startInstance`'s subject, a campaign's
 * `release.ref`, an effect's `field.set` of the document it just wrote — points
 * outside the workflow resource. The engine refuses a ref to a resource the
 * deployment does not declare (`RefResourceUndeclaredError`), and returning a
 * client here IS the declaration: the surface is built from `workflowResource`
 * plus whatever this resolver serves, nothing else.
 *
 * The sibling returned is the one the engine's own router would derive anyway;
 * memoized because the engine caches auth resolution per client object.
 *
 * `@sanity/workflow-studio`'s `useWorkflowEngine` wires the same shape by
 * default. Every host that builds an engine by hand — the Functions, the
 * dashboard — has to wire it itself or it cannot start a run at all.
 */

import type {SanityClient} from '@sanity/client'
import type {ParsedGdr} from '@sanity/workflow-engine'

/**
 * Narrower than `ResourceClientResolver`, which returns the engine's structural
 * `WorkflowClient` — a sibling of a real client is a real client, and callers
 * that assert on one should not have to widen.
 */
export type ProjectResourceClients = (parsed: ParsedGdr) => SanityClient | undefined

export function projectResourceClients(client: SanityClient): ProjectResourceClients {
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
