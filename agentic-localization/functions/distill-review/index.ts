/**
 * Sanity Function: distil what an approved localization run taught.
 *
 * Triggers on a `localize-document` instance reaching `approved` — an observer of
 * finished runs, not a phase of one, so nothing here can fail a localization. It
 * diffs the machine draft against the text a human approved, gates on the diff
 * before spending anything, and writes DRAFT `l10n.proposal` documents for a
 * reviewer to accept. See `docs/decisions/adr-002-learning-loop.md`.
 *
 * The event source is the WORKFLOWS dataset, so the content dataset is named in
 * the blueprint env rather than derived from the event — the mirror image of
 * `start-localization`, which is triggered by content and reaches the other way.
 */

import type {SanityClient} from '@sanity/client'
import type {FunctionContext} from '@sanity/functions'

import {documentEventHandler} from '@sanity/functions'
import {distillReview} from '@starter/l10n/distill'
import {APPROVED_STAGE, localizeDocument} from '@starter/l10n/workflows'

import {localizationEngine, requireEnv, workflowsClient} from '../engine'

const NAME = 'distill-review'

/** The instance document, under the blueprint's projection. */
interface InstanceEventData {
  _id: string
  _type: string
  definition: string
  currentStage: string
}

/**
 * The content dataset, from the workflows-dataset credentials the event carried.
 *
 * A plain sibling rather than a resource resolved through the engine: the loop
 * reads and writes content directly and never asks the engine to commit a ref,
 * so there is nothing here for the declared-resource surface to gate.
 */
function contentClient(context: FunctionContext): SanityClient {
  return workflowsClient(context.clientOptions, NAME).withConfig({
    dataset: requireEnv('CONTENT_DATASET_NAME'),
  })
}

/**
 * The handler, with its content client injectable.
 *
 * One seam, for one reason: the loop makes an Agent Actions call, and the e2e
 * suite drives this handler for real while canning exactly that. Production
 * takes the default and the deployed artifact has no test-only branch in it.
 */
export function createDistillHandler(clientFor: (context: FunctionContext) => SanityClient) {
  return documentEventHandler<InstanceEventData>(async ({context, event}) => {
    const {currentStage, definition, _id: instanceId} = event.data

    // The blueprint filter already narrows to this pair. Re-checked because the
    // filter is a string in a config the compiler never sees, and a redelivery
    // after a filter change would otherwise distil a run mid-flight.
    if (definition !== localizeDocument.name || currentStage !== APPROVED_STAGE) {
      console.log(`[${NAME}] ${instanceId}: ignoring ${definition} in ${currentStage}`)
      return
    }

    const engine = localizationEngine(workflowsClient(context.clientOptions, NAME), NAME, {})

    const result = await distillReview({
      client: clientFor(context),
      dataset: requireEnv('CONTENT_DATASET_NAME'),
      engine,
      instanceId,
      log: (message) => console.log(`[${NAME}] ${message}`),
    })

    console.log(
      `[${NAME}] ${instanceId}: ${result.outcome} — ${result.proposals} proposal(s), ` +
        `${result.aiSpent} AI call(s), claim ${result.claimId}`,
    )
  })
}

export const handler = createDistillHandler(contentClient)
