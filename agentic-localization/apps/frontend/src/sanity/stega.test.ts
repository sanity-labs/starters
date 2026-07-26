import type {FilterDefault} from 'next-sanity'
import {describe, expect, it} from 'vitest'

import {stegaFilter} from './stega'

type FilterProps = Parameters<FilterDefault>[0]

function props(overrides: Partial<FilterProps>): FilterProps {
  return {
    sourcePath: ['title'],
    resultPath: ['title'],
    sourceDocument: {_id: 'locale.de-DE', _type: 'l10n.locale'},
    value: 'de-DE',
    filterDefault: () => true,
    ...overrides,
  }
}

describe('stegaFilter', () => {
  it('never encodes a locale code', () => {
    expect(stegaFilter(props({sourcePath: ['code'], resultPath: ['code']}))).toBe(false)
  })

  it('never encodes the code a fallback reference resolves to', () => {
    expect(stegaFilter(props({sourcePath: ['code'], resultPath: ['locales', 0, 'fallback']}))).toBe(
      false,
    )
  })

  it('defers to the default filter for everything else', () => {
    expect(stegaFilter(props({filterDefault: () => true}))).toBe(true)
    expect(stegaFilter(props({filterDefault: () => false}))).toBe(false)
  })
})
