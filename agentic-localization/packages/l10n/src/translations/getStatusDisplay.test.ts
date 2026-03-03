import {describe, expect, it} from 'vitest'
import {getStatusDisplay} from './getStatusDisplay'
import type {TranslationStatus} from '../core/types'

const ALL_STATUSES: TranslationStatus[] = [
  // Workflow states
  'missing',
  'usingFallback',
  'needsReview',
  'approved',
  'stale',
  // In-flight
  'translating',
  'failed',
]

describe('getStatusDisplay', () => {
  it.each(ALL_STATUSES)('returns icon, tone, label, and tooltip for "%s"', (status) => {
    const display = getStatusDisplay(status)
    expect(display).toHaveProperty('icon')
    expect(display.icon).toBeDefined()
    expect(display).toHaveProperty('tone')
    expect(typeof display.tone).toBe('string')
    expect(display).toHaveProperty('label')
    expect(typeof display.label).toBe('string')
    expect(display.label.length).toBeGreaterThan(0)
    expect(display).toHaveProperty('tooltip')
    expect(typeof display.tooltip).toBe('string')
  })

  it('throws for unknown status', () => {
    expect(() => getStatusDisplay('bogus' as TranslationStatus)).toThrow(
      'Unknown translation status: "bogus"',
    )
  })

  it('returns positive tone for approved', () => {
    expect(getStatusDisplay('approved').tone).toBe('positive')
  })

  it('returns critical tone for missing', () => {
    expect(getStatusDisplay('missing').tone).toBe('critical')
  })

  it('returns caution tone for stale', () => {
    expect(getStatusDisplay('stale').tone).toBe('caution')
  })
})
