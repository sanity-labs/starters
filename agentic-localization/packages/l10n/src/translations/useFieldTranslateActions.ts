/**
 * Bulk translate actions for field-level i18n with workflow metadata tracking.
 *
 * Reuses the same patterns as `useTranslateActions.ts`:
 * - useReducer for per-cell in-flight state (`{fieldPath}::{localeId}` composite keys)
 * - useTransition for `isTranslating`
 * - Promise-based semaphore for max concurrency
 * - AbortController for cancellation
 *
 * Translation uses the same two-step pattern as `useTranslateFieldAction`:
 * 1. Patch document: setIfMissing → unset → append (with source value)
 * 2. Call translate() targeting the entry's `value` field
 * 3. NEW: Patch fieldTranslation.metadata with workflow state (needsReview)
 *
 * Also provides approve, dismissStale, and approveAll actions.
 */

import {useCallback, useEffect, useMemo, useReducer, useRef, useTransition} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  getDraftId,
  getPublishedId,
  getVersionId,
  useClient,
  useCurrentUser,
  useDocumentPairPermissions,
  usePerspective,
} from 'sanity'
import {randomKey} from '@sanity/util/content'
import type {InternationalizedArrayItem} from 'sanity-plugin-internationalized-array'

import {useTranslate} from '../useTranslate'
import type {InternationalizedFieldDescriptor} from '../fieldActions/useInternationalizedFields'
import type {FieldCellState} from '../core/types'
import {getFieldTranslationMetadataId} from '../core/fieldMetadataIds'
import type {Language} from './useLocales'
import type {FieldTranslationSnapshot} from './useFieldTranslationData'
import {createSemaphore} from './createSemaphore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 5
const LOG_PREFIX = '[l10n:field-translate]'
const FIELD_METADATA_TYPE = 'fieldTranslation.metadata'

// ---------------------------------------------------------------------------
// Composite key helpers
// ---------------------------------------------------------------------------

function cellKey(fieldPath: string, localeId: string): string {
  return `${fieldPath}::${localeId}`
}

/**
 * Deterministic _key for workflow state array entries.
 * Sanitized to only contain characters valid for Sanity _key (alphanumeric + hyphen).
 * e.g., 'bio' + 'fr-FR' → 'bio--fr-FR'
 */
function workflowStateKey(fieldPath: string, localeId: string): string {
  return `${fieldPath.replace(/\./g, '-')}--${localeId}`
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface CellInFlightState {
  status: 'translating' | 'failed'
  error?: string
}

type CellAction =
  | {type: 'start'; key: string}
  | {type: 'fail'; key: string; error: string}
  | {type: 'complete'; key: string}
  | {type: 'clear'; key: string}

function cellReducer(
  state: Record<string, CellInFlightState>,
  action: CellAction,
): Record<string, CellInFlightState> {
  switch (action.type) {
    case 'start':
      return {...state, [action.key]: {status: 'translating'}}
    case 'fail':
      return {...state, [action.key]: {status: 'failed', error: action.error}}
    case 'complete':
    case 'clear': {
      const {[action.key]: _, ...rest} = state
      return rest
    }
  }
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface FieldTranslateActionsResult {
  /** Translate a single cell (field + locale) */
  translateCell: (fieldPath: string, localeId: string) => void
  /** Translate all empty locales for one field */
  translateField: (fieldPath: string) => void
  /** Translate all empty fields for one locale */
  translateLocale: (localeId: string) => void
  /** Translate all empty cells */
  translateAllEmpty: () => void
  /** Approve a single cell's translation */
  approveCell: (fieldPath: string, localeId: string) => void
  /** Approve all needsReview cells */
  approveAll: () => void
  /** Dismiss stale status — user confirms translation is still valid */
  dismissStaleCell: (fieldPath: string, localeId: string) => void
  /** Per-cell in-flight states */
  inFlightStates: Record<string, CellInFlightState>
  /** Whether any translation is in progress */
  isTranslating: boolean
  /** Whether the user has permission to update metadata (null while loading) */
  metadataPermission: boolean | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFieldTranslateActions(
  snapshot: FieldTranslationSnapshot,
  schemaId: string,
  documentType: string,
  cellStates?: Record<string, Record<string, FieldCellState>>,
): FieldTranslateActionsResult {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const {translate} = useTranslate()
  const {perspectiveStack, selectedReleaseId} = usePerspective()
  const currentUser = useCurrentUser()

  const [isTranslating, startTransition] = useTransition()
  const [, startApproveTransition] = useTransition()
  const [inFlightStates, dispatch] = useReducer(cellReducer, {})

  const semaphoreRef = useRef(createSemaphore(MAX_CONCURRENT))
  const abortControllersRef = useRef(new Map<string, AbortController>())

  // Deterministic metadata ID
  const metadataId = useMemo(
    () => getFieldTranslationMetadataId(snapshot.documentId),
    [snapshot.documentId],
  )

  // Permission gating
  const [metadataPermissions, metadataPermissionsLoading] = useDocumentPairPermissions({
    id: metadataId,
    type: FIELD_METADATA_TYPE,
    permission: 'update',
  })
  const metadataPermission = metadataPermissionsLoading
    ? null
    : (metadataPermissions?.granted ?? false)

  // Cleanup on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current
    return () => {
      for (const c of controllers.values()) c.abort()
      controllers.clear()
    }
  }, [])

  // Stable refs to snapshot data for use in callbacks
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const cellStatesRef = useRef(cellStates)
  cellStatesRef.current = cellStates

  const processCell = useCallback(
    async (field: InternationalizedFieldDescriptor, locale: Language): Promise<void> => {
      const snap = snapshotRef.current
      const {documentId} = snap
      const sourceLocaleId = snap.sourceLanguages[field.displayPath]
      if (!sourceLocaleId) {
        throw new Error(`No source content for field "${field.displayPath}"`)
      }

      // Resolve the perspective-aware document ID.
      const actionDocumentId = selectedReleaseId
        ? getVersionId(documentId, selectedReleaseId)
        : getDraftId(documentId)

      const fieldName = field.path.join('.')
      const itemType = `${field.typeName}Value`
      const entryKey = randomKey(12)

      // Step 1: Patch — create target entry with source value for context.
      const doc = await client.fetch<Record<string, unknown> | null>(
        `*[_id == $id][0]`,
        {id: documentId},
        {perspective: perspectiveStack},
      )
      if (!doc) throw new Error('Document not found')

      // Ensure the target document (draft/version) exists before patching.
      // When the inspector opens on a published document there is no draft yet.
      await client.createIfNotExists({
        ...doc,
        _id: actionDocumentId,
        _type: doc._type as string,
      })

      // Navigate to the field
      let current: unknown = doc
      for (const segment of field.path) {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[segment]
        } else {
          current = undefined
          break
        }
      }

      const entries = (Array.isArray(current) ? current : []) as InternationalizedArrayItem[]
      const sourceEntry = entries.find(
        (e) => e.language === sourceLocaleId && e.value != null && e.value !== '',
      )
      if (!sourceEntry?.value) {
        throw new Error(`No source value for field "${field.displayPath}" in ${sourceLocaleId}`)
      }

      const sourceSnapshot = JSON.stringify(sourceEntry.value)

      // Step 2: Translate the source value without writing (noWrite).
      // This avoids a replication-delay race where the Agent API reads
      // the document before a just-committed array entry is visible.
      const translated = await translate(
        {
          schemaId,
          documentId: actionDocumentId,
          fromLanguage: {id: sourceLocaleId},
          toLanguage: {id: locale.id, title: locale.title},
          target: {path: [...field.path, {_key: sourceEntry._key}, 'value']},
          noWrite: true,
        },
        doc,
      )

      // Extract the translated value from the returned document.
      let translatedField: unknown = translated
      for (const segment of field.path) {
        translatedField = (translatedField as Record<string, unknown> | undefined)?.[segment]
      }
      const translatedEntries = Array.isArray(translatedField) ? translatedField : []
      const translatedEntry = translatedEntries.find(
        (e: Record<string, unknown>) => e._key === sourceEntry._key,
      )
      if (!translatedEntry?.value) {
        throw new Error(`Translation returned no value for "${field.displayPath}"`)
      }

      // Step 3: Write the target entry with the translated value.
      await client
        .patch(actionDocumentId)
        .setIfMissing({[fieldName]: []})
        .unset([`${fieldName}[language=="${locale.id}"]`])
        .append(fieldName, [
          {_key: entryKey, _type: itemType, language: locale.id, value: translatedEntry.value},
        ])
        .commit()

      // Step 4: Patch fieldTranslation.metadata with workflow state
      const publishedId = getPublishedId(documentId)
      const tx = client.transaction()
      tx.createIfNotExists({
        _id: metadataId,
        _type: FIELD_METADATA_TYPE,
        documentRef: {_ref: publishedId, _type: 'reference'},
        documentType,
        workflowStates: [],
      })
      tx.patch(metadataId, (p) =>
        p
          .setIfMissing({workflowStates: []})
          .unset([`workflowStates[_key=="${workflowStateKey(field.displayPath, locale.id)}"]`])
          .append('workflowStates', [
            {
              _key: workflowStateKey(field.displayPath, locale.id),
              field: field.displayPath,
              language: locale.id,
              status: 'needsReview',
              source: 'ai',
              updatedAt: new Date().toISOString(),
              sourceSnapshot,
            },
          ]),
      )
      await tx.commit()
    },
    [client, translate, schemaId, perspectiveStack, selectedReleaseId, metadataId, documentType],
  )

  // Use ref for in-flight guard to avoid re-creating translateCell on every state change.
  const inFlightRef = useRef(inFlightStates)
  inFlightRef.current = inFlightStates

  const translateCell = useCallback(
    (fieldPath: string, localeId: string) => {
      const key = cellKey(fieldPath, localeId)
      if (inFlightRef.current[key]) return

      const field = snapshotRef.current.fields.find((f) => f.displayPath === fieldPath)
      const locale = snapshotRef.current.locales.find((l) => l.id === localeId)
      if (!field || !locale) return

      const controller = new AbortController()
      abortControllersRef.current.set(key, controller)
      dispatch({type: 'start', key})

      startTransition(async () => {
        await semaphoreRef.current.acquire()
        try {
          if (controller.signal.aborted) return
          await processCell(field, locale)
          if (!controller.signal.aborted) dispatch({type: 'complete', key})
        } catch (err) {
          console.error(`${LOG_PREFIX} [${fieldPath}:${localeId}] Failed:`, err)
          if (!controller.signal.aborted) {
            dispatch({
              type: 'fail',
              key,
              error: err instanceof Error ? err.message : `Failed to translate ${fieldPath}`,
            })
          }
        } finally {
          semaphoreRef.current.release()
          abortControllersRef.current.delete(key)
        }
      })
    },
    [processCell, startTransition],
  )

  // ---------------------------------------------------------------------------
  // Approve action
  // ---------------------------------------------------------------------------

  const approveCell = useCallback(
    (fieldPath: string, localeId: string) => {
      startApproveTransition(async () => {
        try {
          const tx = client.transaction()
          tx.createIfNotExists({
            _id: metadataId,
            _type: FIELD_METADATA_TYPE,
            documentRef: {_ref: getPublishedId(snapshot.documentId), _type: 'reference'},
            documentType,
            workflowStates: [],
          })
          tx.patch(metadataId, (p) =>
            p
              .setIfMissing({workflowStates: []})
              .unset([`workflowStates[_key=="${workflowStateKey(fieldPath, localeId)}"]`])
              .append('workflowStates', [
                {
                  _key: workflowStateKey(fieldPath, localeId),
                  field: fieldPath,
                  language: localeId,
                  status: 'approved',
                  source: cellStatesRef.current?.[fieldPath]?.[localeId]?.source ?? 'ai',
                  updatedAt: new Date().toISOString(),
                  reviewedBy: currentUser?.id,
                  sourceSnapshot: snapshotRef.current.currentSourceValues[fieldPath],
                },
              ]),
          )
          await tx.commit({autoGenerateArrayKeys: true})
        } catch (err) {
          console.error(`${LOG_PREFIX} [approve ${fieldPath}:${localeId}] Failed:`, err)
        }
      })
    },
    [client, metadataId, currentUser, snapshot.documentId, documentType, startApproveTransition],
  )

  // ---------------------------------------------------------------------------
  // Approve all needsReview cells
  // ---------------------------------------------------------------------------

  const approveAll = useCallback(() => {
    if (!cellStatesRef.current) return

    startApproveTransition(async () => {
      try {
        const tx = client.transaction()
        tx.createIfNotExists({
          _id: metadataId,
          _type: FIELD_METADATA_TYPE,
          documentRef: {_ref: getPublishedId(snapshot.documentId), _type: 'reference'},
          documentType,
          workflowStates: [],
        })

        let hasEntries = false
        for (const [fieldPath, localeStates] of Object.entries(cellStatesRef.current!)) {
          for (const [localeId, cellState] of Object.entries(localeStates)) {
            if (cellState.status !== 'needsReview') continue
            hasEntries = true
            tx.patch(metadataId, (p) =>
              p
                .setIfMissing({workflowStates: []})
                .unset([`workflowStates[_key=="${workflowStateKey(fieldPath, localeId)}"]`])
                .append('workflowStates', [
                  {
                    _key: workflowStateKey(fieldPath, localeId),
                    field: fieldPath,
                    language: localeId,
                    status: 'approved',
                    source: cellState.source ?? 'ai',
                    updatedAt: new Date().toISOString(),
                    reviewedBy: currentUser?.id,
                    sourceSnapshot: snapshotRef.current.currentSourceValues[fieldPath],
                  },
                ]),
            )
          }
        }

        if (hasEntries) {
          await tx.commit()
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} [approveAll] Failed:`, err)
      }
    })
  }, [client, metadataId, currentUser, snapshot.documentId, documentType, startApproveTransition])

  // ---------------------------------------------------------------------------
  // Dismiss stale action
  // ---------------------------------------------------------------------------

  const dismissStaleCell = useCallback(
    (fieldPath: string, localeId: string) => {
      startApproveTransition(async () => {
        try {
          const currentSourceSnapshot = snapshotRef.current.currentSourceValues[fieldPath]
          const tx = client.transaction()
          tx.createIfNotExists({
            _id: metadataId,
            _type: FIELD_METADATA_TYPE,
            documentRef: {_ref: getPublishedId(snapshot.documentId), _type: 'reference'},
            documentType,
            workflowStates: [],
          })
          tx.patch(metadataId, (p) =>
            p
              .setIfMissing({workflowStates: []})
              .unset([`workflowStates[_key=="${workflowStateKey(fieldPath, localeId)}"]`])
              .append('workflowStates', [
                {
                  _key: workflowStateKey(fieldPath, localeId),
                  field: fieldPath,
                  language: localeId,
                  status: 'approved',
                  source: cellStatesRef.current?.[fieldPath]?.[localeId]?.source ?? 'ai',
                  updatedAt: new Date().toISOString(),
                  reviewedBy: currentUser?.id,
                  sourceSnapshot: currentSourceSnapshot,
                },
              ]),
          )
          await tx.commit()
        } catch (err) {
          console.error(`${LOG_PREFIX} [dismissStale ${fieldPath}:${localeId}] Failed:`, err)
        }
      })
    },
    [client, metadataId, currentUser, snapshot.documentId, documentType, startApproveTransition],
  )

  // ---------------------------------------------------------------------------
  // Actionable cells
  // ---------------------------------------------------------------------------

  const emptyCells = useMemo(() => {
    const cells: Array<{fieldPath: string; localeId: string}> = []
    const {matrix, sourceLanguages} = snapshot
    for (const [fieldPath, localeStatuses] of Object.entries(matrix)) {
      if (!sourceLanguages[fieldPath]) continue // no source content
      for (const [localeId, status] of Object.entries(localeStatuses)) {
        if (status === 'empty' && localeId !== sourceLanguages[fieldPath]) {
          cells.push({fieldPath, localeId})
        }
      }
    }
    return cells
  }, [snapshot])

  const translateField = useCallback(
    (fieldPath: string) => {
      for (const cell of emptyCells) {
        if (cell.fieldPath === fieldPath) {
          translateCell(cell.fieldPath, cell.localeId)
        }
      }
    },
    [emptyCells, translateCell],
  )

  const translateLocale = useCallback(
    (localeId: string) => {
      for (const cell of emptyCells) {
        if (cell.localeId === localeId) {
          translateCell(cell.fieldPath, cell.localeId)
        }
      }
    },
    [emptyCells, translateCell],
  )

  const translateAllEmpty = useCallback(() => {
    for (const cell of emptyCells) {
      translateCell(cell.fieldPath, cell.localeId)
    }
  }, [emptyCells, translateCell])

  return {
    translateCell,
    translateField,
    translateLocale,
    translateAllEmpty,
    approveCell,
    approveAll,
    dismissStaleCell,
    inFlightStates,
    isTranslating,
    metadataPermission,
  }
}
