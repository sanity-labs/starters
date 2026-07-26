import {describe, expect, it} from 'vitest'

import {LOCALIZE_DOCUMENT_STAGES, runPhase} from './stages'

describe('runPhase', () => {
  it('classifies every declared stage', () => {
    expect(
      Object.fromEntries(LOCALIZE_DOCUMENT_STAGES.map((stage) => [stage, runPhase(stage)])),
    ).toEqual({
      analyzing: 'in-progress',
      translating: 'in-progress',
      review: 'review',
      approved: 'settled',
      done: 'settled',
      failed: 'failed',
    })
  })

  it('reports a stage from another deployment as unknown, not an error', () => {
    expect(runPhase('quarantined')).toBe('unknown')
  })
})
