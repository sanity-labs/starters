/**
 * Realtime subscription to `fieldTranslation.metadata` for a given document.
 *
 * Provides the raw workflow states array and a pre-computed map keyed by
 * `field::language` for O(1) lookups in `deriveFieldCellStates()`.
 *
 * Uses `documentStore.listenQuery()` for realtime updates — same pattern
 * as `useTranslationPaneData.ts`.
 */

import {useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getPublishedId, useDocumentStore} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import {defineQuery} from 'groq'

import {
  fieldWorkflowStatesToMap,
  type FieldWorkflowStateEntry,
} from '../core/types'
import {getFieldTranslationMetadataId} from '../core/fieldMetadataIds'

const FIELD_METADATA_QUERY = defineQuery(
  `*[_id == $metadataId][0]{ workflowStates }`,
)

export interface FieldWorkflowMetadata {
  /** Raw workflow states array from the metadata document */
  states: FieldWorkflowStateEntry[]
  /** Pre-computed map keyed by `field::language` */
  stateMap: Record<string, FieldWorkflowStateEntry>
  /** The metadata document ID (deterministic) */
  metadataId: string
}

/**
 * Realtime subscription to field-level workflow metadata for a document.
 *
 * Returns an empty states array while loading or if no metadata exists.
 */
export function useFieldWorkflowMetadata(documentId: string): FieldWorkflowMetadata {
  const documentStore = useDocumentStore()
  const publishedId = getPublishedId(documentId)
  const metadataId = getFieldTranslationMetadataId(publishedId)

  const metadata$ = useMemo(
    () =>
      documentStore.listenQuery(
        FIELD_METADATA_QUERY,
        {metadataId},
        DEFAULT_STUDIO_CLIENT_OPTIONS,
      ),
    [documentStore, metadataId],
  )

  const rawResult = useObservable(metadata$) as
    | {workflowStates: FieldWorkflowStateEntry[] | null}
    | null
    | undefined

  return useMemo(() => {
    const states = rawResult?.workflowStates ?? []
    return {
      states,
      stateMap: fieldWorkflowStatesToMap(states),
      metadataId,
    }
  }, [rawResult, metadataId])
}
