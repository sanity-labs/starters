/**
 * `@starter/l10n-studio/schemas`
 *
 * The document and object types the pattern needs: locales, glossaries, style
 * guides and the learning loop's proposals. `createL10n()` registers all six, so
 * this entry is for registering them yourself — extending a type, renaming a
 * title, or taking the locale document without the rest of the plugin.
 *
 * `defineType`/`defineField` come from `@sanity/types`, not `sanity`. They are
 * the same runtime functions, and importing the leaf package keeps a schema
 * registration from pulling the Studio into a consumer's bundle.
 */

export {glossaryEntry} from './glossaryEntry'
export {localeTranslation} from './localeTranslation'
/** A factory: `subject` references the project's own localization subject types. */
export {proposal} from './proposal'
export {translationGlossary} from './translationGlossary'
export {translationLocale} from './translationLocale'
export {translationStyleGuide} from './translationStyleGuide'

/** Adds the language field to every localized document type. */
export {injectLanguageField, LOCALE_EXISTS_QUERY, validateLocaleCode} from './languageField'
