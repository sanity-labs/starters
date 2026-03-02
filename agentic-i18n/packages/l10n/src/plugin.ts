import {definePlugin, type SchemaTypeDefinition} from 'sanity'
import {documentInternationalization, type Language} from '@sanity/document-internationalization'

import {localeTranslation} from './schemas/localeTranslation'
import {glossaryEntry} from './schemas/glossaryEntry'
import {translationLocale} from './schemas/translationLocale'
import {translationGlossary} from './schemas/translationGlossary'
import {translationStyleGuide} from './schemas/translationStyleGuide'
import {l10nUsEnglishLocaleBundle} from './i18n'
import {SUPPORTED_LANGUAGES_QUERY} from './queries'
import {languageFieldName} from './types'
import {injectLanguageField} from './languageField'
import {LocaleNavbar} from './components/LocaleNavbar'
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
          supportedLanguages: (client) => client.fetch<Language[]>(SUPPORTED_LANGUAGES_QUERY),
          schemaTypes: [...localizedSchemaTypes],
        }),
      ],
    })(),
    injectLanguageField: (types: SchemaTypeDefinition[]) => (prev: SchemaTypeDefinition[]) =>
      injectLanguageField(localizedSchemaTypes)([...prev, ...types]),
  }
}
