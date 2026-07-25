/**
 * Sanity Function: abort every localization run whose subject was deleted.
 *
 * Without this a deleted source leaves its run parked in review forever,
 * holding a publish guard on a document that no longer exists.
 */

import {documentEventHandler} from '@sanity/functions'
import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {gdrUri} from '@sanity/workflow-engine'

import {localizationEngine, requireEnv, workflowsClient} from '../engine'

const NAME = 'handle-deleted-subject'

/** The deleted document, under the blueprint's projection. */
interface DeleteEventData {
  _id: string
  _type: string
}

export const handler = documentEventHandler<DeleteEventData>(async ({context, event}) => {
  const publishedId = getPublishedId(DocumentId(event.data._id))

  const client = workflowsClient(context.clientOptions, NAME).withConfig({
    dataset: requireEnv('WORKFLOWS_DATASET_NAME'),
  })
  const engine = localizationEngine(client, NAME)

  const subject = gdrUri({
    scheme: 'dataset',
    projectId: context.clientOptions.projectId,
    dataset: context.clientOptions.dataset,
    documentId: publishedId,
  })

  const open = await engine.instancesForDocument({document: subject})
  const failures: string[] = []

  // Sequential: an abort cascades to children, and a parent's write races its
  // own descendants otherwise. Aborting a terminal instance is a no-op.
  for (const instance of open) {
    try {
      await engine.abortInstance({
        instanceId: instance._id,
        reason: 'Subject deleted',
        idempotencyKey: `delete:${publishedId}`,
      })
    } catch (error) {
      failures.push(`${instance._id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(
    `[${NAME}] ${publishedId}: aborted ${open.length - failures.length} of ${open.length}`,
  )

  if (failures.length > 0) {
    throw new Error(`[${NAME}] ${failures.length} abort(s) failed: ${failures.join('; ')}`)
  }
})
