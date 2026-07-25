/**
 * Once per `pnpm e2e`: prove the credentials, make sure the datasets exist, and
 * clear whatever a previous run left behind.
 *
 * The sweep is age-based rather than unconditional. A run's own `dispose` is
 * what normally cleans up; this only catches the run that was killed before it
 * got there — and only litter old enough that it cannot belong to this one.
 */

import {contentClient, workflowsClient} from './clients'
import {ensureDatasets} from './datasets'
import {
  assertE2eCredentials,
  CONTENT_DATASET,
  RETENTION_MS,
  RUN_PREFIX,
  WORKFLOWS_DATASET,
} from './env'

/** Engine-written lake guards. Advisory to the engine, a real publish lock to an editor. */
const GUARD_TYPE = 'temp.system.guard'

export async function setup(): Promise<void> {
  assertE2eCredentials()
  await ensureDatasets()

  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()

  // Definitions and instances of runs that never disposed. Their tags are
  // per-run, so nothing here can be shared with a live run.
  const workflows = await workflowsClient().delete({
    query: '*[string::startsWith(tag, $prefix) && _updatedAt < $cutoff]',
    params: {prefix: 'e2e-', cutoff},
  })

  // Run documents, plus any guard those runs left holding a publish lock.
  const content = await contentClient().delete({
    query:
      '*[(string::startsWith(_id, $prefix) || string::startsWith(_id, $draftPrefix) || _type == $guard) && _updatedAt < $cutoff]',
    params: {prefix: RUN_PREFIX, draftPrefix: `drafts.${RUN_PREFIX}`, guard: GUARD_TYPE, cutoff},
  })

  const swept = (workflows.results?.length ?? 0) + (content.results?.length ?? 0)
  console.log(
    `[e2e] datasets ready (${CONTENT_DATASET} + ${WORKFLOWS_DATASET})` +
      (swept > 0 ? `; swept ${swept} stale document(s)` : ''),
  )
}
