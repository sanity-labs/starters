/**
 * Sanity Function: drain one workflow instance's pending effects, then advance it.
 *
 * Triggers on writes to `sanity.workflow.instance` documents in the workflows
 * dataset that carry pending effects. The definitions keep at most one effect
 * pending per instance, so an invocation is at most one AI call — backpressure
 * is structural, not a limiter here.
 */

import {documentEventHandler} from '@sanity/functions'

import {localizationEngine, workflowsClient} from '../engine'

const NAME = 'drain-effects'

/** The instance document, under the blueprint's projection. */
interface InstanceEventData {
  _id: string
  _type: string
}

export const handler = documentEventHandler<InstanceEventData>(async ({context, event}) => {
  const instanceId = event.data._id

  // The event source IS the workflows dataset, so `clientOptions` already
  // points where the engine needs to write.
  const engine = localizationEngine(workflowsClient(context.clientOptions, NAME), NAME)

  const {drained, failed, lost, skipped} = await engine.drainEffects({instanceId})
  console.log(
    `[${NAME}] ${instanceId}: ${drained.length} drained, ${failed.length} failed, ${skipped.length} skipped, ${lost.length} lost`,
  )
  for (const effect of failed) {
    console.error(`[${NAME}] ${instanceId}: effect "${effect.name}" failed`)
  }

  await engine.tick({instanceId})
})
