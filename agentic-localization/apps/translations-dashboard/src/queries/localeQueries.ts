import {defineQuery} from 'groq'

/** Fetch all locale documents for the dashboard. */
export const LOCALES_QUERY = defineQuery(`*[_type == "l10n.locale"]{
  "code": code,
  title,
  flag,
  "fallbackCode": fallback->code
}`)
