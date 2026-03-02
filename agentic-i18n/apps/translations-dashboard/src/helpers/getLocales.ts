import {getFlagFromCode} from '@starter/l10n'
import type {SanityClient} from 'sanity'

import {LOCALES_QUERY} from '../queries/localeQueries'

export type Locale = {
  fallbackLocale?: null | string
  flag?: string
  id: string
  releaseId?: string
  title: string
}

/**
 * Fetch locale documents from Sanity.
 *
 * Uses `_type == "l10n.locale"` with the `.code` field (not `.tag`)
 * to match the starter project's locale schema.
 */
export async function getLocales(client: SanityClient): Promise<Locale[]> {
  const locales =
    await client.fetch<
      Array<{code: string; fallbackCode: null | string; flag: string; title: string}>
    >(LOCALES_QUERY)

  return locales.map((locale) => ({
    fallbackLocale: locale.fallbackCode,
    flag: locale.flag || getFlagFromCode(locale.code),
    id: locale.code,
    title: locale.title,
  }))
}
