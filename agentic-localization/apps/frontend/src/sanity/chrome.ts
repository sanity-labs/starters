import {sanityFetch, type Preview} from './live'
import {CHROME_QUERY} from './queries'
import type {Locale} from './types'
import {resolveUiStrings, type UiStrings} from './uiStrings'

/**
 * The site chrome for one locale: every label already resolved, plus the locale
 * graph the switcher renders. One cached fetch, shared by every page — the
 * strings and the locales come from the same query because resolving one needs
 * the other.
 */
export async function getChrome(
  language: string,
  preview: Preview,
): Promise<{strings: UiStrings; locales: Locale[]}> {
  'use cache'

  const {data} = await sanityFetch({query: CHROME_QUERY, ...preview})

  return {
    strings: resolveUiStrings(data.strings, language, data.locales),
    locales: data.locales,
  }
}
