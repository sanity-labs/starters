import {describe, expect, it} from 'vitest'
import type {ResolvedFieldEntry} from '@sanity/workflow-engine'

import {
  readDocumentId,
  readFlag,
  readLocaleRequests,
  readMateriality,
  readProgress,
  readReleaseName,
  readText,
} from './instanceFields'

const fields: ResolvedFieldEntry[] = [
  {_key: 'a', _type: 'string', name: 'materiality', value: 'material'},
  {_key: 'b', _type: 'text', name: 'explanation', value: 'Pricing changed in three markets.'},
  {_key: 'c', _type: 'boolean', name: 'sourceChanged', value: true},
  {_key: 'd', _type: 'boolean', name: 'hasFailedLocales', value: false},
  {
    _key: 'e',
    _type: 'array',
    name: 'targetLocales',
    of: [],
    value: [{locale: 'de-DE', reason: 'body rewritten'}, {locale: 'fr-FR'}, {reason: 'no locale'}],
  },
  {
    _key: 'f',
    _type: 'doc.ref',
    name: 'target',
    value: {id: 'dataset:p1:production:article-de', type: 'article'},
  },
  {
    _key: 'g',
    _type: 'release.ref',
    name: 'release',
    value: {
      id: 'dataset:p1:production:_.releases.spring',
      type: 'system.release',
      releaseName: 'spring',
    },
  },
  {_key: 'h', _type: 'progress', name: 'translationProgress', value: 60},
]

describe('instanceFields', () => {
  it('reads string and text entries, and nothing else', () => {
    expect(readText(fields, 'materiality')).toBe('material')
    expect(readText(fields, 'explanation')).toBe('Pricing changed in three markets.')
    expect(readText(fields, 'sourceChanged')).toBeNull()
    expect(readText(fields, 'absent')).toBeNull()
  })

  it('treats a missing or non-boolean flag as false', () => {
    expect(readFlag(fields, 'sourceChanged')).toBe(true)
    expect(readFlag(fields, 'hasFailedLocales')).toBe(false)
    expect(readFlag(fields, 'materiality')).toBe(false)
    expect(readFlag(fields, 'absent')).toBe(false)
  })

  it('constrains materiality to the definition’s closed list', () => {
    expect(readMateriality(fields)).toBe('material')
    expect(
      readMateriality([{_key: 'a', _type: 'string', name: 'materiality', value: 'urgent'}]),
    ).toBeNull()
    expect(readMateriality([])).toBeNull()
  })

  it('skips locale rows that carry no locale', () => {
    expect(readLocaleRequests(fields, 'targetLocales')).toEqual([
      {locale: 'de-DE', reason: 'body rewritten'},
      {locale: 'fr-FR', reason: undefined},
    ])
    expect(readLocaleRequests(fields, 'absent')).toEqual([])
  })

  it('unwraps a doc ref to its bare document id', () => {
    expect(readDocumentId(fields, 'target')).toBe('article-de')
    expect(readDocumentId(fields, 'materiality')).toBeNull()
  })

  it('reads the release name and the progress value', () => {
    expect(readReleaseName(fields, 'release')).toBe('spring')
    expect(readReleaseName(fields, 'target')).toBeNull()
    expect(readProgress(fields, 'translationProgress')).toBe(60)
    expect(readProgress(fields, 'absent')).toBeNull()
  })
})
