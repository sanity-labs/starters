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

import {createDistillHandler} from '@starter/functions/distill-review'
import {handler as handleDeletedSubject} from '@starter/functions/handle-deleted-subject'
import {handler as startLocalization} from '@starter/functions/start-localization'
import {APPROVED_STAGE, localizeDocument} from '@starter/l10n/workflows'
import {WORKFLOW_INSTANCE_TYPE} from '@sanity/workflow-engine'

import {CONTENT_DATASET, resourceId, WORKFLOWS_DATASET} from './env'

/**
 * What the platform hands a document Function. `clientOptions` is the whole
 * contract the handlers use — the rest labels the invocation.
 *
 * `dataset` is the EVENT SOURCE, which differs per Function: the publish and
 * delete Functions are triggered by content, `distill-review` by an instance.
 */
function contextFor(harness: Harness, dataset = CONTENT_DATASET): FunctionContext {
  return {
    eventResourceType: 'dataset',
    eventResourceId: resourceId(harness.projectId, dataset),
    functionResourceType: 'project',
    functionResourceId: harness.projectId,
    local: true,
    clientOptions: {
      projectId: harness.projectId,
      dataset,
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

/**
 * The instance-update event that reaches `approved` — the learning loop's trigger.
 *
 * The real handler, with the one dependency a journey cannot let it build itself:
 * the loop makes an Agent Actions call, so its content client is the harness's
 * canned one. Everything else — the engine wiring, the claim, the History reads,
 * the gate, the proposal writes — is the deployed code.
 */
export async function deliverApproved(harness: Harness, instanceId: string): Promise<void> {
  const handler = createDistillHandler(() => harness.cannedContent)
  await handler({
    context: contextFor(harness, WORKFLOWS_DATASET),
    event: {
      data: {
        _id: instanceId,
        _type: WORKFLOW_INSTANCE_TYPE,
        definition: localizeDocument.name,
        currentStage: APPROVED_STAGE,
      },
    },
  })
}
