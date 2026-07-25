/**
 * How the reviewer's surface renders one engine action.
 *
 * The three-way verdict is the engine's (`actionRendering`): a failed `filter`
 * means the action does not exist for this actor — absent, never a disabled
 * button — and a cascade-fired one is the engine's to fire. Only `button`
 * reaches the reviewer, with a reason on the disabled ones.
 */

import type {
  ActionEvaluation,
  DisabledReason,
  TerminalActivityStatus,
} from '@sanity/workflow-engine'

import {actionDisabledDetail, actionRendering, deniedGuardLabels} from '@sanity/workflow-engine'

/** Editor copy for the one kind a reviewer meets daily — `actionDisabledDetail` is worded for a dev-facing host (its docstring names the CLI). */
const REVIEW_ENDED: Record<TerminalActivityStatus, string> = {
  done: 'The review is already complete.',
  skipped: 'The review was skipped.',
  failed: 'The review failed.',
}

export function fireableActions(actions: readonly ActionEvaluation[]): ActionEvaluation[] {
  return actions.filter((action) => actionRendering(action) === 'button')
}

/**
 * The two kinds a reviewer actually hits get editor copy; `mutation-guard-denied`
 * names its guards; every other kind — including ones we never enumerated — falls
 * back to the engine's wording rather than to a parallel per-kind copy of it.
 */
export function disabledMessage(reason: DisabledReason | undefined): string | undefined {
  if (!reason) return undefined
  switch (reason.kind) {
    case 'activity-not-active':
      return REVIEW_ENDED[reason.status]
    case 'stage-terminal':
      return `This run has already finished in "${reason.stage}".`
    case 'mutation-guard-denied':
      return `Held by ${deniedGuardLabels(reason.denied).join(', ')}.`
    default:
      return `Not available: ${actionDisabledDetail(reason)}`
  }
}
