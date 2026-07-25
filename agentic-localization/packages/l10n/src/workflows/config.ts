/**
 * Engine coordinates: where instances are stored, and which partition of that
 * store this stack owns.
 *
 * One pair for the whole starter. The deploy (`sanity.workflow.ts`), the
 * runtime Functions (`sanity.blueprint.ts`), the Studio plugin and the
 * dashboard all have to name the same dataset and tag — a reader pointed at a
 * different partition sees no instances at all.
 */

/** Engine storage. Content documents stay in the main dataset. */
export const WORKFLOWS_DATASET = 'workflows'

/** The partition within that dataset — instances, definitions and guards. */
export const WORKFLOW_TAG = 'production'
