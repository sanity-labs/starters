/**
 * Hook to fetch the workflow state for a translated document (realtime).
 *
 * Language field is read via `useDocumentValues` (perspective-aware preview store).
 * Metadata uses `documentStore.listenQuery()` since it requires a `references()` filter
 * to find the translation.metadata doc.
 */

import {useMemo} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  getDraftId,
  getPublishedId,
  useDocumentStore,
  useDocumentValues,
} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import {defineQuery} from 'groq'
import type {WORKFLOW_METADATA_QUERY_RESULT} from '@starter/sanity-types'
import type {TranslationsConfig, WorkflowStateEntry} from '../core/types'
import {resolveConfig, workflowStatesToMap} from '../core/types'

const WORKFLOW_METADATA_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && (references($publishedId) || references($draftId))
][0]{
  _id,
  workflowStates
}`)

export interface UseDocumentWorkflowStateResult {
  workflowEntry: WorkflowStateEntry | undefined
  language: string | undefined
  isBaseLanguage: boolean
}

export function useDocumentWorkflowState(
  documentId: string,
  documentType: string,
  config: TranslationsConfig,
): UseDocumentWorkflowStateResult {
  const resolved = useMemo(() => resolveConfig(config), [config])
  const documentStore = useDocumentStore()

  const isInternationalized = resolved.internationalizedTypes.includes(documentType)
  const publishedId = getPublishedId(documentId)
  const draftId = getDraftId(publishedId)

  // Language field via preview store (perspective-aware, no manual coalesce)
  const languagePaths = useMemo(() => [resolved.languageField], [resolved.languageField])
  const {value: langDoc, isLoading: langLoading} = useDocumentValues(
    isInternationalized ? publishedId : '',
    languagePaths,
  )
  const language: string | null | undefined = !isInternationalized
    ? null
    : langLoading
      ? undefined
      : typeof (langDoc as Record<string, unknown>)?.[resolved.languageField] === 'string'
        ? ((langDoc as Record<string, unknown>)[resolved.languageField] as string)
        : null

  // Metadata via listenQuery (requires references() filter to find the doc)
  const metadata$ = useMemo(
    () =>
      isInternationalized
        ? documentStore.listenQuery(
            WORKFLOW_METADATA_QUERY,
            {draftId, publishedId},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          )
        : of(null as WORKFLOW_METADATA_QUERY_RESULT),
    [documentStore, draftId, publishedId, isInternationalized],
  )
  const metadata = useObservable(metadata$) as WORKFLOW_METADATA_QUERY_RESULT | undefined

  const isBaseLanguage =
    !resolved.defaultLanguage || !language || language === resolved.defaultLanguage

  const workflowEntry = useMemo(() => {
    if (!language || !metadata?.workflowStates) return undefined
    const map = workflowStatesToMap(metadata.workflowStates as WorkflowStateEntry[])
    return map[language]
  }, [language, metadata])

  return {workflowEntry, language: language ?? undefined, isBaseLanguage}
}
