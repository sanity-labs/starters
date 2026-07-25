/**
 * Studio-side wiring to the Editorial Workflows engine.
 *
 * The coordinates come from `workflows/config.ts`, the same pair
 * `sanity.workflow.ts` deploys against and `workflowStudioPlugin()` is
 * registered with.
 */

import {gdrUri, type Engine, type GdrUri, type WorkflowInstance} from '@sanity/workflow-engine'
import {useDocumentWorkflows, useWorkflowEngine} from '@sanity/workflow-studio'
import {getPublishedId, useWorkspace} from 'sanity'

import {WORKFLOW_TAG, WORKFLOWS_DATASET} from '../workflows/config'
import {localizeDocument} from '../workflows/localizeDocument'

export {
  WORKFLOWS_DATASET as LOCALIZATION_WORKFLOW_DATASET,
  WORKFLOW_TAG as LOCALIZATION_WORKFLOW_TAG,
} from '../workflows/config'

export function useLocalizationEngine(): Engine {
  const {projectId} = useWorkspace()
  return useWorkflowEngine({
    workflowResource: {type: 'dataset', id: `${projectId}.${WORKFLOWS_DATASET}`},
    tag: WORKFLOW_TAG,
  })
}

/** The workspace-resolved GDR for a content document, as instances reference it. */
export function useContentGdr(documentId: string): GdrUri {
  const {projectId, dataset} = useWorkspace()
  return gdrUri({scheme: 'dataset', projectId, dataset, documentId: getPublishedId(documentId)})
}

export interface LocalizationInstanceLookup {
  /** True only while the instance list is still resolving. */
  loading: boolean
  /** The open `localize-document` run for this document, if any. */
  instance: WorkflowInstance | null
  instanceId: string | null
  error: unknown
}

/**
 * The open localization run for a source document. `useDocumentWorkflows`
 * returns in-flight instances only, so an empty result with `loading: false`
 * is a confirmed "nothing running".
 */
export function useLocalizationInstance(documentId: string): LocalizationInstanceLookup {
  const engine = useLocalizationEngine()
  const document = useContentGdr(documentId)
  const {instances, loading, error} = useDocumentWorkflows({engine, document})

  const instance =
    instances?.find((candidate) => candidate.definition === localizeDocument.name) ?? null
  return {loading, instance, instanceId: instance?._id ?? null, error}
}
