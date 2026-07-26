/**
 * Where this app reads content and engine state.
 *
 * The engine coordinates come from the definitions package, so the dashboard
 * cannot drift from the partition the definitions deploy into.
 */

import type {WorkflowResource} from '@sanity/workflow-engine'
import {WORKFLOW_TAG, WORKFLOWS_DATASET, workflowsResource} from '@starter/l10n/workflows'

export {WORKFLOW_TAG, WORKFLOWS_DATASET}

export const PROJECT_ID = import.meta.env.SANITY_APP_PROJECT_ID
export const CONTENT_DATASET = import.meta.env.SANITY_APP_DATASET || 'production'

/** Where content lives — subjects, releases, translations. */
export const CONTENT_RESOURCE: WorkflowResource = {
  id: `${PROJECT_ID}.${CONTENT_DATASET}`,
  type: 'dataset',
}

/** Where the engine's own documents live — definitions, instances, guards. */
export const WORKFLOWS_RESOURCE: WorkflowResource = workflowsResource(PROJECT_ID)
