import type {ActionEvaluation, DisabledReason} from '@sanity/workflow-engine'

import {describe, expect, it} from 'vitest'

import {disabledMessage, fireableActions} from './reviewActionView'

function action(name: string, overrides: Partial<ActionEvaluation> = {}): ActionEvaluation {
  return {action: {name}, allowed: true, ...overrides}
}

function denied(reason: DisabledReason): Partial<ActionEvaluation> {
  return {allowed: false, disabledReason: reason}
}

describe('fireableActions', () => {
  it('drops an action whose filter failed — it does not exist for this actor', () => {
    const actions = [
      action('approve'),
      action(
        'request-changes',
        denied({kind: 'filter-failed', filter: 'false', detail: 'no role'}),
      ),
    ]
    expect(fireableActions(actions).map((entry) => entry.action.name)).toEqual(['approve'])
  })

  it('drops a cascade-fired action, by the flag or by the reason', () => {
    const actions = [
      action('finish', {triggered: true}),
      action('escalate', denied({kind: 'cascade-fired', when: 'true'})),
      action('approve'),
    ]
    expect(fireableActions(actions).map((entry) => entry.action.name)).toEqual(['approve'])
  })

  it('keeps a disabled-but-existing action, which renders with its reason', () => {
    const actions = [action('approve', denied({kind: 'activity-not-active', status: 'done'}))]
    expect(fireableActions(actions)).toHaveLength(1)
  })
})

describe('disabledMessage', () => {
  // The engine's own detail for these reads "activity status is \"done\"" — true,
  // and not a sentence to show a reviewer.
  it('speaks to the reviewer for the two kinds they actually hit', () => {
    expect(disabledMessage({kind: 'activity-not-active', status: 'done'})).toBe(
      'The review is already complete.',
    )
    expect(disabledMessage({kind: 'activity-not-active', status: 'skipped'})).toBe(
      'The review was skipped.',
    )
    expect(disabledMessage({kind: 'activity-not-active', status: 'failed'})).toBe(
      'The review failed.',
    )
    expect(disabledMessage({kind: 'stage-terminal', stage: 'approved'})).toBe(
      'This run has already finished in "approved".',
    )
  })

  it('names the guards holding the run rather than asking the engine for a detail', () => {
    expect(
      disabledMessage({
        kind: 'mutation-guard-denied',
        denied: [{guardId: 'g1', name: 'Campaign lock'}, {guardId: 'g2'}],
      }),
    ).toBe('Held by Campaign lock, g2.')
  })

  it('falls back to the engine wording for reasons we never enumerated', () => {
    expect(disabledMessage({kind: 'instance-aborted', abortedAt: '2026-07-24T10:00:00.000Z'})).toBe(
      'Not available: instance aborted at 2026-07-24T10:00:00.000Z',
    )
    expect(
      disabledMessage({kind: 'requirements-unmet', unmetRequirements: [{name: 'note-written'}]}),
    ).toBe('Not available: unmet requirement(s): note-written')
  })

  it('has nothing to say about an allowed action', () => {
    expect(disabledMessage(undefined)).toBeUndefined()
  })
})
