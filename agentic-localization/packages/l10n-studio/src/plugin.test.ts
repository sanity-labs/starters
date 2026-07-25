import {describe, it, expect} from 'vitest'
import {documentInternationalization} from '@sanity/document-internationalization'
import type {
  DocumentActionComponent,
  DocumentActionsContext,
  DocumentBadgeComponent,
  DocumentBadgesContext,
} from 'sanity'
import {proposalTypeName} from '@starter/l10n'
import {SOURCE_LANGUAGE} from '@starter/l10n/workflows'

import {createL10n} from './plugin'
import {proposalActions} from './proposals'

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

/**
 * The two registrations the learning loop's reviewer surface needs. Neither is
 * typed against anything: the schema list is an array and the actions resolver is
 * a callback over a string, so a rename would go unnoticed until a reviewer
 * opened a proposal and found the default action set.
 */
describe('the proposal registration', () => {
  const {plugin} = createL10n({localizedSchemaTypes: ['article'], defaultLanguage: SOURCE_LANGUAGE})

  function actionsContext(schemaType: string): DocumentActionsContext {
    return {schemaType} as unknown as DocumentActionsContext
  }

  function defaultAction(): DocumentActionComponent {
    return function PublishAction() {
      return null
    }
  }

  function resolveActions(prev: DocumentActionComponent[], schemaType: string) {
    const actions = plugin.document?.actions
    if (typeof actions !== 'function') {
      throw new Error('the l10n plugin no longer contributes an actions resolver')
    }
    return actions(prev, actionsContext(schemaType))
  }

  it('registers the proposal document type', () => {
    const names = (plugin.schema?.types as {name: string}[]).map((type) => type.name)
    expect(names).toContain(proposalTypeName)
  })

  it('replaces the default actions for a proposal rather than extending them', () => {
    // Publishing or duplicating a proposal is meaningless — Accept files it and
    // Reject deletes it.
    expect(resolveActions([defaultAction()], proposalTypeName)).toEqual(proposalActions)
  })

  it('leaves the actions of every other type alone', () => {
    const prev = [defaultAction()]
    expect(resolveActions(prev, 'article')).toBe(prev)
    expect(resolveActions(prev, 'l10n.glossary')).toBe(prev)
  })
})
