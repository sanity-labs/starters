import {definePlugin, type SchemaTypeDefinition} from 'sanity'
import {documentInternationalization, type Language} from '@sanity/document-internationalization'
import {internationalizedArray} from 'sanity-plugin-internationalized-array'

import {localeTranslation} from './schemas/localeTranslation'
import {glossaryEntry} from './schemas/glossaryEntry'
import {translationLocale} from './schemas/translationLocale'
import {translationGlossary} from './schemas/translationGlossary'
import {translationStyleGuide} from './schemas/translationStyleGuide'
import {uiStrings} from './schemas/uiStrings'
import {l10nUsEnglishLocaleBundle} from './i18n'
import {SUPPORTED_LANGUAGES_QUERY} from '@starter/l10n/prompts'
import {fieldTierTypes, languageFieldName, proposalTypeName} from '@starter/l10n'
import {proposal} from './schemas/proposal'
import {proposalActions} from './proposals'
import {injectLanguageField} from './schemas/languageField'
import {LocaleNavbar} from './components/LocaleNavbar'
import {L10nLayout} from './components/L10nLayout'
import {LocaleBadge} from './components/LocaleBadge'
import {createTranslationInspector} from './translations/createTranslationPanePlugin'

interface L10nOptions {
  localizedSchemaTypes: readonly string[]
  /** The source language every run reads from — `SOURCE_LANGUAGE`. */
  defaultLanguage: string
}

export function createL10n({localizedSchemaTypes, defaultLanguage}: L10nOptions) {
  const translationInspector = createTranslationInspector({
    internationalizedTypes: [...localizedSchemaTypes],
    defaultLanguage,
    languageField: languageFieldName,
  })

  return {
    plugin: definePlugin({
      name: 'l10n',
      i18n: {
        bundles: [l10nUsEnglishLocaleBundle],
      },
      studio: {
        components: {
          navbar: LocaleNavbar,
          layout: L10nLayout,
        },
      },
      schema: {
        types: [
          // Object types
          localeTranslation,
          glossaryEntry,
          // Document types
          translationLocale,
          translationGlossary,
          translationStyleGuide,
          uiStrings,
          // Both tiers are localization subjects, so both can be a proposal's
          // source: the document tier is configured, the field tier is a registry.
          proposal({subjectTypes: [...localizedSchemaTypes, ...fieldTierTypes()]}),
        ],
        templates: (prev) => [
          ...prev,
          ...localizedSchemaTypes.map((typeName) => ({
            id: `l10n-${typeName}`,
            schemaType: typeName,
            title: typeName.charAt(0).toUpperCase() + typeName.slice(1),
            parameters: [{name: languageFieldName, type: 'string'}],
            value: (params: Record<typeof languageFieldName, string>) => ({
              [languageFieldName]: params[languageFieldName],
            }),
          })),
        ],
      },
      document: {
        inspectors: (prev) => [translationInspector, ...prev],
        // A proposal is evidence with two verbs, so its action set REPLACES the
        // defaults rather than extending them: nothing hand-authors, publishes or
        // duplicates one. Accepting is what files it; rejecting is what deletes it.
        actions: (prev, context) =>
          context.schemaType === proposalTypeName ? proposalActions : prev,
        // No publish gate here. `localize-document` guards its subject against
        // `publish` in both `translating` and `review`, and
        // `@sanity/workflow-studio-plugin` already disables the action from that
        // guard. `schedule` is the one action its lock map does not cover — see
        // `createLocalizationScheduleGate`, which the Studio config wraps,
        // because the core injects `schedule` after plugins run.

        // Replace the plain locale badge from @sanity/document-internationalization
        // with our flag-enhanced version. The i18n plugin wraps LanguageBadge in an
        // anonymous arrow, so we identify it by exclusion: keep only named badges
        // (Sanity defaults like "LiveEditBadge") and append ours.
        badges: (prev, context) =>
          localizedSchemaTypes.includes(context.schemaType)
            ? [...prev.filter((badge) => badge.name !== ''), LocaleBadge]
            : prev,
      },
      plugins: [
        documentInternationalization({
          hideLanguageFilter: (ctx) => localizedSchemaTypes.includes(ctx.schemaType),
          supportedLanguages: (client) =>
            client.fetch<Language[]>(SUPPORTED_LANGUAGES_QUERY, {}, {tag: 'plugin.languages'}),
          schemaTypes: [...localizedSchemaTypes],
        }),
        internationalizedArray({
          languages: (client) =>
            client.fetch<Language[]>(SUPPORTED_LANGUAGES_QUERY, {}, {tag: 'plugin.languages'}),
          defaultLanguages: [defaultLanguage],
          fieldTypes: ['string', 'text'],
        }),
      ],
    })(),
    injectLanguageField: (types: SchemaTypeDefinition[]) => (prev: SchemaTypeDefinition[]) =>
      injectLanguageField(localizedSchemaTypes)([...prev, ...types]),
  }
}
