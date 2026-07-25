/**
 * Sanity Function: periodic sweep over every in-flight workflow instance.
 *
 * Recovers claims whose drainer died and ticks for the time-and-drift
 * conditions no content event announces — `sourceChanged` above all.
 * Dispatching what a sweep frees is the drainer's job: the released claim
 * still satisfies its `count(pendingEffects) > 0` filter, and an AI-sized
 * dispatch would not survive this function's 60s budget anyway. Best-effort:
 * `start-localization` ticks on every publish, so the pipeline runs without
 * this.
 */

import {scheduledEventHandler} from '@sanity/functions'
import {sweepStaleClaims, tagScopeFilter, WORKFLOW_INSTANCE_TYPE} from '@sanity/workflow-engine'

import {executionContext, localizationEngine, requireEnv, workflowsClient} from '../engine'

const NAME = 'heartbeat'

/** `completedAt` is stamped on entry into any terminal stage, aborts included. */
const IN_FLIGHT_INSTANCES = `*[_type == "${WORKFLOW_INSTANCE_TYPE}" && ${tagScopeFilter()} && !defined(completedAt)]._id`

export const handler = scheduledEventHandler(async ({context}) => {
  // Scheduled functions have no event source, so every `clientOptions` field is
  // optional — the dataset and project come from the blueprint's env instead.
  const token = context.clientOptions?.token ?? process.env.SANITY_AUTH_TOKEN
  if (!token) {
    console.warn(`[${NAME}] no token available — skipping sweep`)
    return
  }

  const client = workflowsClient(
    {
      projectId: requireEnv('SANITY_PROJECT_ID'),
      dataset: requireEnv('WORKFLOWS_DATASET_NAME'),
      token,
    },
    NAME,
  )
  const engine = localizationEngine(client, NAME)

  // `engine.query` binds `$tag` and scopes the read to the workflow resource.
  const instanceIds = await engine.query<string[]>({groq: IN_FLIGHT_INSTANCES})

  const failures: string[] = []
  for (const instanceId of instanceIds) {
    try {
      await sweepStaleClaims({
        client,
        tag: engine.tag,
        instanceId,
        executionContext: executionContext(NAME),
      })
      await engine.tick({instanceId})
    } catch (error) {
      // One stuck instance must not starve the rest of the sweep.
      failures.push(`${instanceId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`[${NAME}] swept ${instanceIds.length - failures.length} of ${instanceIds.length}`)

  if (failures.length > 0) {
    throw new Error(`[${NAME}] ${failures.length} instance(s) failed: ${failures.join('; ')}`)
  }
})
