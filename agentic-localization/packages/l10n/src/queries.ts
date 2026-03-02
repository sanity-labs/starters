import {defineQuery} from 'groq'
import {glossaryTypeName, localeTypeName, styleGuideTypeName} from './types'

/**
 * Fetches all configured locales for the language selector.
 *
 * Returns: {id: string, title: string}[]
 */
export const SUPPORTED_LANGUAGES_QUERY = defineQuery(
  `*[_type == "${localeTypeName}"] | order(title asc) { "id": code, title }`,
)

/**
 * Fetches all glossaries with entries and translations resolved.
 * Used by the translation inspector for prompt assembly.
 */
export const GLOSSARIES_QUERY = defineQuery(`*[_type == "${glossaryTypeName}"]{
  title,
  "sourceLocale": sourceLocale->{
    code,
    title
  },
  entries[]{
    term,
    "status": coalesce(status, "approved"),
    doNotTranslate,
    partOfSpeech,
    definition,
    context,
    translations[]{
      "locale": locale->code,
      translation,
      gender
    }
  }
}`)

/**
 * Fetches the style guide for a specific locale.
 *
 * Parameters: $localeCode (string) — BCP-47 code of the target locale
 */
export const STYLE_GUIDE_FOR_LOCALE_QUERY = defineQuery(`*[
  _type == "${styleGuideTypeName}"
  && locale->code == $localeCode
][0]{
  title,
  "locale": locale->{
    code,
    title
  },
  "formality": coalesce(formality, "formal"),
  tone,
  additionalInstructions
}`)
