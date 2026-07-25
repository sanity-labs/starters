import {describe, expect, it} from 'vitest'

import {computeFieldChanges} from '../core/computeFieldChanges'
import {compareSides} from './compareSides'

const PERSON = 'person'

function person(entries: {bio?: [string, string][]; metaTitle?: [string, string][]}) {
  return {
    _type: PERSON,
    name: 'Elena Vasquez',
    ...(entries.bio && {
      bio: entries.bio.map(([language, value]) => ({
        _key: `bio-${language}`,
        _type: 'internationalizedArrayTextValue',
        language,
        value,
      })),
    }),
    ...(entries.metaTitle && {
      seo: {
        _type: 'seo',
        metaTitle: entries.metaTitle.map(([language, value]) => ({
          _key: `title-${language}`,
          _type: 'internationalizedArrayStringValue',
          language,
          value,
        })),
      },
    }),
  }
}

describe('compareSides', () => {
  it('passes a document-tier type through untouched', () => {
    const published = {_type: 'article', title: 'Published'}
    const pending = {_type: 'article', title: 'Pending'}

    expect(compareSides({documentType: 'article', published, pending})).toEqual({
      published,
      pending,
      editPaths: {},
    })
  })

  it('treats a field-tier type with no locale as a whole-document compare', () => {
    const pending = person({bio: [['de-DE', 'Neu']]})

    expect(compareSides({documentType: PERSON, published: null, pending}).pending).toBe(pending)
  })

  it('reduces both sides to one locale, keyed by field path', () => {
    const sides = compareSides({
      documentType: PERSON,
      locale: 'de-DE',
      published: person({
        bio: [
          ['en-US', 'English bio'],
          ['de-DE', 'Alte Biografie'],
        ],
        metaTitle: [['de-DE', 'Alter Titel']],
      }),
      pending: person({
        bio: [
          ['en-US', 'English bio'],
          ['de-DE', 'Neue Biografie'],
        ],
        metaTitle: [['de-DE', 'Alter Titel']],
      }),
    })

    expect(sides.published).toEqual({
      bio: 'Alte Biografie',
      'seo.metaTitle': 'Alter Titel',
      'seo.metaDescription': undefined,
    })
    expect(sides.pending.bio).toBe('Neue Biografie')
  })

  it('ignores the locales the run did not write', () => {
    const sides = compareSides({
      documentType: PERSON,
      locale: 'de-DE',
      published: person({bio: [['fr-FR', 'Ancienne bio']]}),
      pending: person({
        bio: [
          ['fr-FR', 'Nouvelle bio'],
          ['de-DE', 'Neue Biografie'],
        ],
      }),
    })

    const changed = computeFieldChanges(sides.published, sides.pending).filter((c) => c.changed)
    expect(changed.map((change) => change.fieldName)).toEqual(['bio'])
    expect(changed[0].magnitude).toBe('added')
  })

  it('reads the edit path off the pending entry, whose key the handler generated', () => {
    const sides = compareSides({
      documentType: PERSON,
      locale: 'de-DE',
      published: null,
      pending: person({bio: [['de-DE', 'Neue Biografie']], metaTitle: [['de-DE', 'Titel']]}),
    })

    expect(sides.editPaths).toEqual({
      bio: 'bio[_key=="bio-de-DE"].value',
      'seo.metaTitle': 'seo.metaTitle[_key=="title-de-DE"].value',
    })
  })

  it('offers no edit path for a field the locale has no entry in', () => {
    const sides = compareSides({
      documentType: PERSON,
      locale: 'ja-JP',
      published: null,
      pending: person({bio: [['de-DE', 'Neue Biografie']]}),
    })

    expect(sides.editPaths).toEqual({})
  })
})
