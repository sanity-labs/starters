import {describe, expect, it} from 'vitest'
import type {FieldWorkflowStateEntry} from '../core/types'
import type {FieldTranslationSnapshot} from './useFieldTranslationData'
import {deriveFieldCellStates, findNewlyStaleEntries} from './deriveFieldCellStates'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<FieldTranslationSnapshot> = {}): FieldTranslationSnapshot {
  return {
    documentId: 'person-1',
    fields: [],
    locales: [],
    matrix: {},
    sourceLanguages: {},
    currentSourceValues: {},
    ...overrides,
  }
}

function makeMetaEntry(
  field: string,
  language: string,
  overrides: Partial<FieldWorkflowStateEntry> = {},
): FieldWorkflowStateEntry {
  return {
    _key: `${field}--${language}`,
    field,
    language,
    status: 'needsReview',
    source: 'ai',
    updatedAt: '2026-03-12T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// deriveFieldCellStates
// ---------------------------------------------------------------------------

describe('deriveFieldCellStates', () => {
  it('Rule 1: empty entry → missing', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'es-MX': 'empty'}},
      sourceLanguages: {bio: 'en-US'},
    })
    const result = deriveFieldCellStates(snap, {}, {})
    expect(result.bio['es-MX'].status).toBe('missing')
  })

  it('source locale is always approved', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'es-MX': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
    })
    const result = deriveFieldCellStates(snap, {}, {})
    expect(result.bio['en-US']).toEqual({status: 'approved', source: 'manual'})
  })

  it('Rule 2: filled entry, no metadata → approved (implicit)', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'fr-FR': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
    })
    const result = deriveFieldCellStates(snap, {}, {})
    expect(result.bio['fr-FR'].status).toBe('approved')
  })

  it('Rule 3: metadata needsReview, source unchanged → needsReview', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'es-MX': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"Hello"'},
    })
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {
        status: 'needsReview',
        sourceSnapshot: '"Hello"',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['es-MX'].status).toBe('needsReview')
    expect(result.bio['es-MX'].source).toBe('ai')
  })

  it('Rule 4: metadata needsReview, source changed → stale', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'es-MX': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"Updated Hello"'},
    })
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {
        status: 'needsReview',
        sourceSnapshot: '"Hello"',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['es-MX'].status).toBe('stale')
  })

  it('Rule 4: metadata approved, source changed → stale', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'de-DE': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"New bio"'},
    })
    const stateMap = {
      'bio::de-DE': makeMetaEntry('bio', 'de-DE', {
        status: 'approved',
        sourceSnapshot: '"Old bio"',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['de-DE'].status).toBe('stale')
  })

  it('Rule 5: metadata already stale → stale', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'fr-FR': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"Hello"'},
    })
    const stateMap = {
      'bio::fr-FR': makeMetaEntry('bio', 'fr-FR', {
        status: 'stale',
        sourceSnapshot: '"Hello"',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['fr-FR'].status).toBe('stale')
  })

  it('Rule 6: metadata approved, source unchanged → approved', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'ja-JP': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"Hello"'},
    })
    const stateMap = {
      'bio::ja-JP': makeMetaEntry('bio', 'ja-JP', {
        status: 'approved',
        sourceSnapshot: '"Hello"',
        reviewedBy: 'user-abc',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['ja-JP'].status).toBe('approved')
    expect(result.bio['ja-JP'].reviewedBy).toBe('user-abc')
  })

  it('handles multiple fields independently', () => {
    const snap = makeSnapshot({
      matrix: {
        bio: {'en-US': 'filled', 'fr-FR': 'filled'},
        tagline: {'en-US': 'filled', 'fr-FR': 'empty'},
      },
      sourceLanguages: {bio: 'en-US', tagline: 'en-US'},
      currentSourceValues: {bio: '"Bio text"', tagline: '"Tagline"'},
    })
    const stateMap = {
      'bio::fr-FR': makeMetaEntry('bio', 'fr-FR', {
        status: 'approved',
        sourceSnapshot: '"Bio text"',
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    expect(result.bio['fr-FR'].status).toBe('approved')
    expect(result.tagline['fr-FR'].status).toBe('missing')
  })

  it('no sourceSnapshot in metadata skips stale check', () => {
    const snap = makeSnapshot({
      matrix: {bio: {'en-US': 'filled', 'es-MX': 'filled'}},
      sourceLanguages: {bio: 'en-US'},
      currentSourceValues: {bio: '"Changed"'},
    })
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {
        status: 'needsReview',
        sourceSnapshot: undefined,
      }),
    }
    const result = deriveFieldCellStates(snap, stateMap, snap.currentSourceValues)
    // sourceSnapshot is null/undefined → isSourceChanged is false → stays needsReview
    expect(result.bio['es-MX'].status).toBe('needsReview')
  })
})

// ---------------------------------------------------------------------------
// findNewlyStaleEntries
// ---------------------------------------------------------------------------

describe('findNewlyStaleEntries', () => {
  it('finds entries that are stale in cellStates but not in metadata', () => {
    const cellStates = {
      bio: {
        'es-MX': {status: 'stale' as const},
        'fr-FR': {status: 'approved' as const},
      },
    }
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {status: 'needsReview'}),
      'bio::fr-FR': makeMetaEntry('bio', 'fr-FR', {status: 'approved'}),
    }
    const result = findNewlyStaleEntries(cellStates, stateMap)
    expect(result).toEqual([{field: 'bio', language: 'es-MX'}])
  })

  it('skips entries already marked stale in metadata', () => {
    const cellStates = {
      bio: {'es-MX': {status: 'stale' as const}},
    }
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {status: 'stale'}),
    }
    const result = findNewlyStaleEntries(cellStates, stateMap)
    expect(result).toEqual([])
  })

  it('skips entries with no metadata (stale without metadata = missing, not stale)', () => {
    const cellStates = {
      bio: {'es-MX': {status: 'stale' as const}},
    }
    const result = findNewlyStaleEntries(cellStates, {})
    expect(result).toEqual([])
  })

  it('returns empty array when nothing is stale', () => {
    const cellStates = {
      bio: {
        'es-MX': {status: 'approved' as const},
        'fr-FR': {status: 'needsReview' as const},
      },
    }
    const stateMap = {
      'bio::es-MX': makeMetaEntry('bio', 'es-MX', {status: 'approved'}),
      'bio::fr-FR': makeMetaEntry('bio', 'fr-FR', {status: 'needsReview'}),
    }
    const result = findNewlyStaleEntries(cellStates, stateMap)
    expect(result).toEqual([])
  })
})
