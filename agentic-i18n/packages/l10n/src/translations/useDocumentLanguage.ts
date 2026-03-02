/**
 * Hook to read a document's language field value.
 *
 * Uses Studio's `useDocumentValues()` which observes via the preview store
 * and respects the active perspective (draft/published/release).
 * Works in any component context — not limited to form providers.
 *
 * Returns a discriminated union mirroring Sanity's `LoadableState`:
 * - `{isLoading: true}` — still fetching
 * - `{isLoading: false, error}` — fetch failed
 * - `{isLoading: false, language}` — resolved (may be `undefined` if field unset)
 */

import {useMemo} from 'react'
import {getPublishedId, useDocumentValues} from 'sanity'

export type UseDocumentLanguageResult =
  | {isLoading: true}
  | {isLoading: false; language: string | undefined; error: null}
  | {isLoading: false; error: Error}

export function useDocumentLanguage(
  documentId: string,
  languageField: string,
): UseDocumentLanguageResult {
  const publishedId = getPublishedId(documentId)
  const paths = useMemo(() => [languageField], [languageField])
  const {value, error, isLoading} = useDocumentValues(publishedId, paths)

  if (isLoading) return {isLoading: true}

  if (error) return {isLoading: false, error}

  const fieldValue = (value as Record<string, unknown> | undefined)?.[languageField]
  const language = typeof fieldValue === 'string' ? fieldValue : undefined

  return {isLoading: false, language, error: null}
}
