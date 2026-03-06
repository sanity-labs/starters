import {useApp} from '../contexts/AppContext'

/**
 * Hook that builds the complete filter query for posts based on status and default language.
 *
 * Uses `translationsConfig.languageField` instead of hardcoding 'language' in GROQ strings.
 * @returns The complete filter query string for useDocuments
 */
export const useDocumentFilter = () => {
  const {defaultLanguage, status, translationsConfig} = useApp()

  const buildFilter = (): string => {
    const baseLanguage = defaultLanguage || 'en-US'
    const langField = translationsConfig.languageField

    switch (status) {
      case 'fully-translated':
        // Documents that have metadata AND all locales are translated
        return `${langField} == "${baseLanguage}" && count(*[_type == "translation.metadata" && references(^._id)].translations[]) == count(*[_type == "l10n.locale"])`

      case 'partially-translated':
        // Documents that have metadata with at least one OTHER translation besides the base language
        // BUT not all translations (less than total locale count)
        return `${langField} == "${baseLanguage}" && count(*[_type == "translation.metadata" && references(^._id)].translations[]) > 1 && count(*[_type == "translation.metadata" && references(^._id)].translations[]) < count(*[_type == "l10n.locale"])`

      case 'untranslated':
        // Documents with base language AND (no metadata OR metadata exists but only has one translation)
        return `${langField} == "${baseLanguage}" && (
          !defined(*[_type == "translation.metadata" && references(^._id)][0]) ||
          count(*[_type == "translation.metadata" && references(^._id)][0].translations[]) <= 1
        )`

      case 'all':
      default:
        // Show all documents in the base language
        return `${langField} == "${baseLanguage}"`
    }
  }

  return buildFilter()
}
