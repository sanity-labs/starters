import {definePlugin, type SchemaTypeDefinition} from 'sanity'
import {documentInternationalization, type Language} from '@sanity/document-internationalization'
import {internationalizedArray} from 'sanity-plugin-internationalized-array'

import {localeTranslation} from './schemas/localeTranslation'
import {glossaryEntry} from './schemas/glossaryEntry'
import {translationLocale} from './schemas/translationLocale'
import {translationGlossary} from './schemas/translationGlossary'
import {translationStyleGuide} from './schemas/translationStyleGuide'
import {l10nUsEnglishLocaleBundle} from './i18n'
import {SUPPORTED_LANGUAGES_QUERY} from '@starter/l10n/prompts'
import {languageFieldName} from '@starter/l10n'
import {injectLanguageField} from './schemas/languageField'
import {LocaleNavbar} from './components/LocaleNavbar'
import {L10nProvider} from './L10nProvider'
import {LocaleBadge} from './components/LocaleBadge'
import {createTranslationInspector} from './translations/createTranslationPanePlugin'

interface L10nOptions {
  localizedSchemaTypes: readonly string[]
  defaultLanguage?: string
}

export function createL10n({localizedSchemaTypes, defaultLanguage = 'en-US'}: L10nOptions) {
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
          layout: L10nProvider,
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
