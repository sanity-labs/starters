/**
 * Shared hook for fetching supported locales via `documentStore.listenQuery()`.
 *
 * Extracted from `useTranslationPaneData.ts` and `useTranslateFieldAction.ts`
 * to avoid duplicate subscriptions across surfaces.
 */

import {useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useDocumentStore, usePerspective} from 'sanity'
import {useObservable} from 'react-rx'

import type {Language} from 'sanity-plugin-internationalized-array'

import {SUPPORTED_LANGUAGES_QUERY} from '../queries'

export type {Language}

/**
 * Realtime subscription to supported languages (l10n.locale documents).
 * Returns an empty array while loading, then the deduplicated list of locales.
 */
export function useLocales(): Language[] {
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const languages$ = useMemo(
    () =>
      documentStore.listenQuery(
        SUPPORTED_LANGUAGES_QUERY,
        {},
        {
          ...DEFAULT_STUDIO_CLIENT_OPTIONS,
          perspective: perspectiveStack,
        },
      ),
    [documentStore, perspectiveStack],
  )

  return (useObservable(languages$) as Language[] | undefined) ?? []
}
