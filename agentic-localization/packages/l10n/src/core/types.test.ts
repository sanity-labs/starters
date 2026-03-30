import {describe, expect, it} from 'vitest'
import {workflowStatesToMap} from './types'

describe('workflowStatesToMap', () => {
  it('converts array to locale-keyed map', () => {
    const states = [
      {_key: 'abc', language: 'es-MX', status: 'approved' as const, source: 'ai' as const},
      {_key: 'def', language: 'de-DE', status: 'needsReview' as const, source: 'ai' as const},
    ]
    const map = workflowStatesToMap(states)
    expect(map['es-MX']).toEqual(states[0])
    expect(map['de-DE']).toEqual(states[1])
  })

  it('returns empty map for null', () => {
    expect(workflowStatesToMap(null)).toEqual({})
  })

  it('returns empty map for undefined', () => {
    expect(workflowStatesToMap(undefined)).toEqual({})
  })

  it('skips entries without status', () => {
    const states = [
      {_key: 'abc', language: 'es-MX', status: 'approved' as const},
      {_key: 'def', language: 'de-DE'} as any,
    ]
    const map = workflowStatesToMap(states)
    expect(map['es-MX']).toBeDefined()
    expect(map['de-DE']).toBeUndefined()
  })
})
