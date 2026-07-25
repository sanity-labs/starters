/**
 * `publish-release` — ships the campaign's Content Release, either now or at
 * the scheduled instant.
 *
 * No completion ops: success or failure alone drives the campaign's
 * `to-published` / `back-to-ready` transitions.
 */

import type {ReleaseAction} from '@sanity/client'
import type {EffectHandler} from '@sanity/workflow-engine'

import {releaseDocId} from '@sanity/workflow-engine'

import {contentClientFor, optionalRelease, optionalString} from './effectRuntime'

/**
 * States in which the go-live has already been dispatched. Re-dispatching is
 * not merely wasteful — the API rejects it — so a redelivered effect that finds
 * one of these reports success without acting. This is the handler's
 * idempotency guard: the release's own state is a truer record of "did this
 * already happen" than the instance ledger.
 */
const DISPATCHED_STATES = new Set(['scheduled', 'scheduling', 'published'])

export const publishRelease: EffectHandler = async (params, ctx) => {
  const release = optionalRelease(params, 'release')
  if (!release) {
    throw new Error('publish-release requires a bound release')
  }

  const publishAt = optionalString(params, 'publishAt')
  const client = contentClientFor(ctx, release.id)
  const releaseId = releaseDocId(release.releaseName)

  const current = await client.fetch<null | {state?: string}>(
    `*[_id == $releaseId][0]{state}`,
    {releaseId},
    {tag: 'read-release'},
  )

  if (current?.state && DISPATCHED_STATES.has(current.state)) {
    ctx.log(`Release ${release.releaseName} is already ${current.state}`)
    return
  }

  const action: ReleaseAction = publishAt
    ? {
        actionType: 'sanity.action.release.schedule',
        releaseId: release.releaseName,
        publishAt,
      }
    : {actionType: 'sanity.action.release.publish', releaseId: release.releaseName}

  await client.action(action, {tag: 'publish-release'})
  ctx.log(
    `Release ${release.releaseName} ${publishAt ? `scheduled for ${publishAt}` : 'published'}`,
  )
}
