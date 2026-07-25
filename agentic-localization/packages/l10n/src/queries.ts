import {defineQuery} from 'groq'
import {glossaryTypeName, localeTypeName, styleGuideTypeName} from './types'

/**
 * Fetches all configured locales for the language selector.
 *
 * Returns: {id: string, title: string}[]
 */
export const SUPPORTED_LANGUAGES_QUERY = defineQuery(
  `*[_type == "${localeTypeName}"] | order(title asc) { "id": code, title, "fallbackLocale": fallback->code }`,
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

/**
 * Code + title for named locales — the projection `buildTranslateParams` wants
 * for its `toLanguage` / `fromLanguage` pair.
 *
 * Parameters: $codes (string[]) — BCP-47 codes
 */
export const LOCALES_BY_CODE_QUERY = defineQuery(
  `*[_type == "${localeTypeName}" && code in $codes]{code, title}`,
)

/** Every configured locale code. */
export const LOCALE_CODES_QUERY = defineQuery(`*[_type == "${localeTypeName}"].code`)

/**
 * The `translation.metadata` join document for a source document, with each
 * language's target resolved to a bare document id.
 *
 * Parameters: $metadataId (string), $publishedId (string)
 */
export const TRANSLATIONS_FOR_DOCUMENT_QUERY = defineQuery(`*[
  _id == $metadataId || (
    _type == "translation.metadata" &&
    $publishedId in translations[].value._ref
  )
][0]{
  _id,
  "translations": translations[]{language, "ref": value._ref}
}`)
