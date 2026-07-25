import type {ResolvedFieldEntry} from '@sanity/workflow-engine'

import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {describe, expect, it} from 'vitest'

import {ANALYZE_SOURCE} from '../workflows/effects'
import {localizationWorkflows} from '../workflows'
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

/**
 * The other half of `FieldSource`: a caller holding a whole instance — the Studio
 * run surface, through the session's evaluation — reads through the engine's
 * `resolveFieldEntry` at workflow scope rather than scanning `fields[]`. Driven
 * against the real engine so the scope resolution is the engine's own.
 */
describe('instanceFields over a whole instance', () => {
  async function runWithAnalysis() {
    const source = {
      _id: 'article-1',
      _type: 'article',
      title: 'Instance-scoped reads',
      language: 'en-US',
    }
    const bench = createBench({now: '2026-07-24T09:00:00.000Z', documents: [source]})
    await bench.deployDefinitions({
      expectedMinReaderModel: 4,
      definitions: localizationWorkflows,
    })
    const {instance} = await bench.startInstance({
      definition: 'localize-document',
      initialFields: [subjectField('article-1', {type: 'article'})],
    })
    return bench.completePendingEffect({
      instanceId: instance._id,
      effect: ANALYZE_SOURCE,
      status: 'done',
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'materiality'},
          value: {type: 'literal', value: 'material'},
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'explanation'},
          value: {type: 'literal', value: 'Pricing changed in three markets.'},
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'sourceChanged'},
          value: {type: 'literal', value: true},
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'targetLocales'},
          value: {
            type: 'literal',
            value: [{locale: 'de-DE', reason: 'body changed'}, {locale: 'fr-FR'}],
          },
        },
      ],
    })
  }

  it('reads every workflow-scope field the run surface renders', async () => {
    const {instance} = await runWithAnalysis()

    expect(readMateriality(instance)).toBe('material')
    expect(readText(instance, 'explanation')).toBe('Pricing changed in three markets.')
    expect(readFlag(instance, 'sourceChanged')).toBe(true)
    expect(readFlag(instance, 'hasFailedLocales')).toBe(false)
    expect(readLocaleRequests(instance, 'targetLocales')).toEqual([
      {locale: 'de-DE', reason: 'body changed'},
      {locale: 'fr-FR', reason: undefined},
    ])
    expect(readDocumentId(instance, 'subject')).toBe('article-1')
    expect(readReleaseName(instance, 'release')).toBeNull()
  })
})
