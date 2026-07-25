import {describe, expect, it} from 'vitest'

import type {AcceptableProposal, AcceptTargets} from './acceptProposal'

import {
  ACCEPT_TARGETS_QUERY,
  acceptBlocker,
  acceptedKey,
  glossaryEntryFor,
  readProposal,
  styleRuleBlockFor,
} from './acceptProposal'

const TERM: AcceptableProposal = {
  _id: 'drafts.l10n.proposal.0123456789abcdef',
  kind: 'glossary-term',
  locale: 'de-DE',
  term: 'dataset',
  translation: 'Dataset',
}

const RULE: AcceptableProposal = {
  _id: 'drafts.l10n.proposal.fedcba9876543210',
  kind: 'style-rule',
  locale: 'de-DE',
  rule: 'Address the reader as “Sie”, never “du”.',
}

const TARGETS: AcceptTargets = {
  glossary: {_id: 'glossary-product', keys: []},
  styleGuide: {_id: 'style-de', keys: []},
  localeId: 'locale-de-DE',
}

describe('readProposal', () => {
  it('narrows a proposal document', () => {
    expect(
      readProposal({
        _id: 'drafts.l10n.proposal.abc',
        _type: 'l10n.proposal',
        kind: 'style-rule',
        locale: 'de-DE',
        rule: 'Use Sie.',
        occurrences: 3,
      }),
    ).toEqual({
      _id: 'drafts.l10n.proposal.abc',
      kind: 'style-rule',
      locale: 'de-DE',
      rule: 'Use Sie.',
    })
  })

  it('refuses anything that is not a well-formed proposal', () => {
    expect(readProposal(null)).toBeNull()
    expect(
      readProposal({_id: 'a', _type: 'article', kind: 'style-rule', locale: 'de-DE'}),
    ).toBeNull()
    expect(
      readProposal({_id: 'a', _type: 'l10n.proposal', kind: 'nonsense', locale: 'de'}),
    ).toBeNull()
    expect(readProposal({_id: 'a', _type: 'l10n.proposal', kind: 'style-rule'})).toBeNull()
    expect(
      readProposal({_id: 'a', _type: 'l10n.proposal', kind: 'style-rule', locale: ''}),
    ).toBeNull()
  })
})

/**
 * The hard rule of the whole loop. `GLOSSARIES_QUERY` defaults a status-less
 * entry to `approved` for hand-authored glossaries that predate the field — so an
 * accepted proposal that omitted `status` would be live on publish, with no
 * review having happened at the entry level at all.
 */
describe('glossaryEntryFor', () => {
  const entry = glossaryEntryFor(TERM, 'locale-de-DE')

  it('writes the status explicitly rather than relying on the query default', () => {
    expect(entry.status).toBe('approved')
    expect(Object.keys(entry)).toContain('status')
  })

  it('never writes a do-not-translate instruction', () => {
    expect(JSON.stringify(entry)).not.toContain('doNotTranslate')
  })

  it('references the locale document rather than storing a code', () => {
    expect(entry.translations).toEqual([
      {
        _key: `${acceptedKey(TERM._id)}-de-DE`,
        _type: 'l10n.glossary.entry.translation',
        locale: {_type: 'reference', _ref: 'locale-de-DE'},
        translation: 'Dataset',
      },
    ])
  })

  it('is keyed by the proposal, so re-accepting the same correction is a no-op', () => {
    expect(entry._key).toBe(acceptedKey(TERM._id))
    expect(acceptedKey(TERM._id)).toBe('l10n-0123456789abcdef')
    // The draft prefix must not change the identity.
    expect(acceptedKey('l10n.proposal.0123456789abcdef')).toBe(acceptedKey(TERM._id))
  })
})

describe('styleRuleBlockFor', () => {
  const block = styleRuleBlockFor(RULE)

  it('is a plain Portable Text block carrying the rule verbatim', () => {
    expect(block._type).toBe('block')
    expect(block.style).toBe('normal')
    expect(JSON.stringify(block)).toContain('Address the reader as')
  })

  // The prompt renders `additionalInstructions` to markdown, so provenance rides
  // on the key rather than on visible text a model would then read as guidance.
  it('records its provenance in the key, not in the prose', () => {
    expect(block._key).toBe(acceptedKey(RULE._id))
  })
})

describe('acceptBlocker', () => {
  it('lets a complete term through', () => {
    expect(acceptBlocker(TERM, TARGETS)).toBeNull()
  })

  it('lets a complete rule through', () => {
    expect(acceptBlocker(RULE, TARGETS)).toBeNull()
  })

  it('refuses a term with no glossary to file it in', () => {
    expect(acceptBlocker(TERM, {...TARGETS, glossary: null})).toMatch(/no glossary/)
  })

  it('refuses a term whose locale has no locale document', () => {
    expect(acceptBlocker(TERM, {...TARGETS, localeId: null})).toMatch(/de-DE/)
  })

  // STYLE_GUIDE_FOR_LOCALE_QUERY is [0]-over-type, so creating one here could
  // shadow the guide the reviewer is about to write. Accept patches, never creates.
  it('refuses a rule with no style guide rather than creating one', () => {
    expect(acceptBlocker(RULE, {...TARGETS, styleGuide: null})).toMatch(/no de-DE style guide/)
  })

  it('refuses a payload-less proposal', () => {
    expect(acceptBlocker({...TERM, term: undefined}, TARGETS)).toMatch(/no term/)
    expect(acceptBlocker({...RULE, rule: undefined}, TARGETS)).toMatch(/no rule/)
  })

  it('never blocks an eval case, which has no target to append to', () => {
    expect(
      acceptBlocker(
        {_id: 'drafts.l10n.proposal.a', kind: 'eval-case', locale: 'de-DE'},
        {
          glossary: null,
          styleGuide: null,
          localeId: null,
        },
      ),
    ).toBeNull()
  })
})

describe('ACCEPT_TARGETS_QUERY', () => {
  it('prefers a glossary in the source language and takes one style guide per locale', () => {
    expect(ACCEPT_TARGETS_QUERY).toContain('sourceLocale->code == $sourceLanguage')
    expect(ACCEPT_TARGETS_QUERY).toContain('locale->code == $locale')
    // Existing keys come back with the target so a repeat accept is idempotent.
    expect(ACCEPT_TARGETS_QUERY).toContain('entries[]._key')
    expect(ACCEPT_TARGETS_QUERY).toContain('additionalInstructions[]._key')
  })
})
