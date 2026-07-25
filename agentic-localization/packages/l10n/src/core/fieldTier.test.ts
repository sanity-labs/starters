import {describe, expect, it} from 'vitest'

import {
  coveredLocales,
  entriesOf,
  entryFor,
  internationalizedFields,
  isFieldTier,
  sourceProjection,
  startPerspectiveFor,
} from './fieldTier'

const FIELDS = internationalizedFields('person')
const [BIO, META_TITLE, META_DESCRIPTION] = FIELDS

function entry(language: string, value: unknown, key = `${language}-key`) {
  return {_key: key, _type: 'internationalizedArrayTextValue', language, value}
}

function person(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'person-1',
    _type: 'person',
    name: 'Ada',
    bio: [entry('en-US', 'Bio'), entry('de-DE', 'Biografie')],
    seo: {
      _type: 'seo',
      metaTitle: [entry('en-US', 'Title'), entry('de-DE', 'Titel')],
      metaDescription: [entry('en-US', 'Description'), entry('de-DE', 'Beschreibung')],
    },
    ...overrides,
  }
}

describe('the registry', () => {
  it('knows person is field-tier and article is not', () => {
    expect(isFieldTier('person')).toBe(true)
    expect(isFieldTier('article')).toBe(false)
    expect(internationalizedFields('article')).toEqual([])
  })

  it('registers every internationalized field on person, nested ones included', () => {
    expect(FIELDS.map((field) => field.path)).toEqual([
      'bio',
      'seo.metaTitle',
      'seo.metaDescription',
    ])
  })

  it('declares the ancestor a nested field needs, because a patch will not create it', () => {
    expect(BIO.containers).toEqual([])
    expect(META_TITLE.containers).toEqual([{path: 'seo', value: {_type: 'seo'}}])
  })

  it('picks the read perspective from the tier', () => {
    expect(startPerspectiveFor('person')).toBe('published')
    expect(startPerspectiveFor('article')).toBeUndefined()
  })
})

describe('reading entries', () => {
  it('reads a nested array', () => {
    expect(entriesOf(person(), META_DESCRIPTION).map((row) => row.language)).toEqual([
      'en-US',
      'de-DE',
    ])
  })

  it('treats an absent or malformed field as empty', () => {
    expect(entriesOf(person({bio: undefined}), BIO)).toEqual([])
    expect(entriesOf(person({seo: undefined}), META_TITLE)).toEqual([])
    expect(entriesOf(person({bio: 'not an array'}), BIO)).toEqual([])
    expect(entriesOf(person({bio: [{_key: 'k'}]}), BIO)).toEqual([])
  })

  it('ignores an entry with no content', () => {
    expect(entryFor(person({bio: [entry('de-DE', '')]}), BIO, 'de-DE')).toBeUndefined()
    expect(entryFor(person({bio: [entry('de-DE', null)]}), BIO, 'de-DE')).toBeUndefined()
    expect(entryFor(person(), BIO, 'de-DE')?.value).toBe('Biografie')
  })
})

describe('coverage', () => {
  it('counts a locale only when every field carries it', () => {
    expect(coveredLocales(person(), FIELDS)).toEqual(['en-US', 'de-DE'])
  })

  it('does not count a half-translated locale', () => {
    const half = person({
      seo: {
        _type: 'seo',
        metaTitle: [entry('en-US', 'Title')],
        metaDescription: [entry('en-US', 'Description'), entry('de-DE', 'Beschreibung')],
      },
    })
    expect(coveredLocales(half, FIELDS)).toEqual(['en-US'])
  })

  it('does not count an empty entry as coverage', () => {
    const blank = person({bio: [entry('en-US', 'Bio'), entry('de-DE', '')]})
    expect(coveredLocales(blank, FIELDS)).toEqual(['en-US'])
  })

  it('has no coverage to derive for a document-tier type', () => {
    expect(coveredLocales(person(), [])).toEqual([])
  })
})

describe('the source projection', () => {
  it('keeps only the source-locale values, keyed by field path', () => {
    expect(sourceProjection(person(), FIELDS, 'en-US')).toEqual({
      bio: 'Bio',
      'seo.metaTitle': 'Title',
      'seo.metaDescription': 'Description',
    })
  })

  it('is unmoved by adding a translation — the self-diff loop this exists to break', () => {
    const before = sourceProjection(person({bio: [entry('en-US', 'Bio')]}), FIELDS, 'en-US')
    const after = sourceProjection(person(), FIELDS, 'en-US')
    expect(after).toEqual(before)
  })

  it('records an absent source value rather than dropping the field', () => {
    expect(sourceProjection(person({bio: []}), FIELDS, 'en-US')).toMatchObject({bio: undefined})
    expect('bio' in sourceProjection(person({bio: []}), FIELDS, 'en-US')).toBe(true)
  })
})
