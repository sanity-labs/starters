/**
 * Hook to read a document's language field value.
 *
 * Uses `documentStore.listenQuery()` with a raw-perspective GROQ query
 * that checks both draft and published versions. This is more reliable
 * than `useDocumentValues()` (preview store) for draft-only documents
 * that haven't been indexed yet.
 *
 * Returns a discriminated union:
 * - `{isLoading: true}` — still fetching
 * - `{isLoading: false, error}` — fetch failed
 * - `{isLoading: false, language}` — resolved (may be `undefined` if field unset)
 */

import {useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getDraftId, getPublishedId, useDocumentStore} from 'sanity'
import {useObservable} from 'react-rx'

export type UseDocumentLanguageResult =
  | {isLoading: true}
  | {isLoading: false; language: string | undefined; error: null}
  | {isLoading: false; error: Error}

export function useDocumentLanguage(
  documentId: string,
  languageField: string,
): UseDocumentLanguageResult {
  const documentStore = useDocumentStore()
  const publishedId = getPublishedId(documentId)
  const draftId = getDraftId(documentId)

  // Build query with the configured language field name.
  // coalesce prefers draft over published — matches Studio's editing behavior.
  const query = useMemo(
    () =>
      `coalesce(*[_id == $draftId][0].${languageField}, *[_id == $publishedId][0].${languageField})`,
    [languageField],
  )

  const language$ = useMemo(
    () =>
      documentStore.listenQuery(
        query,
        {draftId, publishedId},
        {
          ...DEFAULT_STUDIO_CLIENT_OPTIONS,
          perspective: 'raw',
        },
      ),
    [documentStore, query, draftId, publishedId],
  )

  const result = useObservable(language$)

  if (result === undefined) return {isLoading: true}

  const language = typeof result === 'string' ? result : undefined

  return {isLoading: false, language, error: null}
}
