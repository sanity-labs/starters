import {describe, it, expect} from 'vitest'
import {documentInternationalization} from '@sanity/document-internationalization'
import type {DocumentBadgeComponent, DocumentBadgesContext} from 'sanity'

// `plugin.ts` replaces the i18n plugin's locale badge by exclusion: the plugin
// wraps `LanguageBadge` in an anonymous arrow, so `badge.name !== ''` keeps the
// named badges and drops theirs. Nothing types that premise — these tests fail
// if a dependency bump names the badge or adds a second anonymous one.

const LOCALIZED_TYPE = 'article'

function namedBadge(): DocumentBadgeComponent {
  return function LiveEditBadge() {
    return null
  }
}

// Studio contexts are large; the badges resolver only reads `schemaType`.
function badgesContext(schemaType: string): DocumentBadgesContext {
  return {schemaType} as unknown as DocumentBadgesContext
}

function resolveBadges(prev: DocumentBadgeComponent[], schemaType: string) {
  const badges = documentInternationalization({
    supportedLanguages: [],
    schemaTypes: [LOCALIZED_TYPE],
  }).document?.badges

  if (typeof badges !== 'function') {
    throw new Error('documentInternationalization no longer contributes a badges resolver')
  }
  return badges(prev, badgesContext(schemaType))
}

describe('documentInternationalization badges', () => {
  it('contributes exactly one anonymous badge for a localized type', () => {
    const resolved = resolveBadges([namedBadge()], LOCALIZED_TYPE)
    expect(resolved.filter((badge) => badge.name === '')).toHaveLength(1)
  })

  it('keeps named badges, so filtering by name only drops the i18n badge', () => {
    const probe = namedBadge()
    const resolved = resolveBadges([probe], LOCALIZED_TYPE)
    expect(resolved.filter((badge) => badge.name !== '')).toEqual([probe])
  })

  it('contributes no badge for a non-localized type', () => {
    const resolved = resolveBadges([namedBadge()], 'person')
    expect(resolved.filter((badge) => badge.name === '')).toHaveLength(0)
  })
})
