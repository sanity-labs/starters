import {describe, expect, it} from 'vitest'
import {workflowStatesToMap} from './types'

describe('workflowStatesToMap', () => {
  it('converts array shape to keyed map', () => {
    const states = [
      {_key: 'es-MX', status: 'approved' as const, source: 'ai' as const},
      {_key: 'de-DE', status: 'needsReview' as const, source: 'ai' as const},
    ]
    const map = workflowStatesToMap(states)
    expect(map['es-MX']).toEqual({_key: 'es-MX', status: 'approved', source: 'ai'})
    expect(map['de-DE']).toEqual({_key: 'de-DE', status: 'needsReview', source: 'ai'})
  })

  it('converts legacy object shape to keyed map with _key injected', () => {
    const states = {
      'es-MX': {status: 'approved' as const, source: 'ai' as const},
      'de-DE': {status: 'stale' as const, source: 'manual' as const},
    }
    const map = workflowStatesToMap(states)
    expect(map['es-MX']).toEqual({_key: 'es-MX', status: 'approved', source: 'ai'})
    expect(map['de-DE']).toEqual({_key: 'de-DE', status: 'stale', source: 'manual'})
  })

  it('returns empty map for null', () => {
    expect(workflowStatesToMap(null)).toEqual({})
  })

  it('returns empty map for undefined', () => {
    expect(workflowStatesToMap(undefined)).toEqual({})
  })

  it('skips array entries without status', () => {
    const states = [
      {_key: 'es-MX', status: 'approved' as const},
      {_key: 'de-DE'}, // no status
    ]
    const map = workflowStatesToMap(states)
    expect(map['es-MX']).toBeDefined()
    expect(map['de-DE']).toBeUndefined()
  })
})
