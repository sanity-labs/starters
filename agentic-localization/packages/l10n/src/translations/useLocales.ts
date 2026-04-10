/**
 * Shared hook for fetching supported locales via a single context-level
 * `documentStore.listenQuery()` subscription (see LocalesContext).
 *
 * All consumers share one EventSource connection instead of each creating
 * their own — prevents reconnection storms on documents with many fields.
 */

import type {Language} from 'sanity-plugin-internationalized-array'

import {useLocalesContext} from '../contexts/LocalesContext'

export type {Language}

/**
 * Realtime subscription to supported languages (l10n.locale documents).
 * Returns `undefined` while loading, then the list of locales.
 */
export function useLocales(): Language[] | undefined {
  return useLocalesContext()
}
