/**
 * Localization coordinates: where instances are stored, which partition of that
 * store this stack owns, and the language a run reads from.
 *
 * One set for the whole starter. The deploy (`sanity.workflow.ts`), the
 * runtime Functions (`sanity.blueprint.ts`), the Studio plugin and the
 * dashboard all have to name the same values — a reader pointed at a
 * different partition sees no instances at all.
 */

import type {WorkflowResource} from '@sanity/workflow-engine'

/** Engine storage. Content documents stay in the main dataset. */
export const WORKFLOWS_DATASET = 'workflows'

/**
 * The API version every host speaks to the engine's store with. One value so
 * the dashboard, the runtime Functions and any future host read and write the
 * same contract.
 */
export const ENGINE_API_VERSION = '2026-07-01'

/** The engine-storage resource for a project, as `createEngine` addresses it. */
export function workflowsResource(projectId: string): WorkflowResource {
  return {type: 'dataset', id: `${projectId}.${WORKFLOWS_DATASET}`}
}

/** The partition within that dataset — instances, definitions and guards. */
export const WORKFLOW_TAG = 'production'

/**
 * The language a localization run reads from. Deployed definitions are static,
 * so this cannot come from the plugin's `defaultLanguage` option at runtime —
 * set it here, redeploy the definitions and the blueprint, and seed a matching
 * first entry in `studio/migrations/seed-locales.ts`.
 */
export const SOURCE_LANGUAGE = 'en-US'
