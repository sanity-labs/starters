/**
 * Deliver a Sanity Function event.
 *
 * The suite calls the deployed handlers, not a copy of their logic: the
 * instance-id derivation, the `StartNotAllowedError` fallback that ticks an
 * already-open run, and the field-tier start perspective are exactly the parts
 * a bench cannot prove. Only the platform's envelope is synthesized.
 */

import type {FunctionContext} from '@sanity/functions'
import type {Published} from './content'
import type {Harness} from './harness'

import {handler as handleDeletedSubject} from '@starter/functions/handle-deleted-subject'
import {handler as startLocalization} from '@starter/functions/start-localization'

import {CONTENT_DATASET, resourceId} from './env'

/**
 * What the platform hands a document Function. `clientOptions` is the whole
 * contract the handlers use — the rest labels the invocation.
 */
function contextFor(harness: Harness): FunctionContext {
  const dataset = resourceId(harness.projectId, CONTENT_DATASET)
  return {
    eventResourceType: 'dataset',
    eventResourceId: dataset,
    functionResourceType: 'project',
    functionResourceId: harness.projectId,
    local: true,
    clientOptions: {
      projectId: harness.projectId,
      dataset: CONTENT_DATASET,
      token: harness.content.config().token ?? '',
    },
  }
}

/**
 * The `publish` event, under the blueprint's projection. Starts a run, or ticks
 * the open one so its `sourceChanged` trigger observes the new revision.
 */
export async function deliverPublish(harness: Harness, document: Published): Promise<void> {
  await startLocalization({
    context: contextFor(harness),
    event: {
      data: {
        _id: document._id,
        _rev: document._rev,
        _type: document._type,
        ...(document._type === 'article' && {language: 'en-US'}),
      },
    },
  })
}

/** The `delete` event: aborts every run whose subject is gone. */
export async function deliverDelete(harness: Harness, document: {_id: string; _type: string}) {
  await handleDeletedSubject({
    context: contextFor(harness),
    event: {data: {_id: document._id, _type: document._type}},
  })
}
