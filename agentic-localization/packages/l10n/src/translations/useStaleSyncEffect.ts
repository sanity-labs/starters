/**
 * Debounced lazy persistence of stale detections to `fieldTranslation.metadata`.
 *
 * When `deriveFieldCellStates()` detects newly-stale entries (source value changed
 * but metadata still says `needsReview` or `approved`), this effect batch-patches
 * those entries to `stale` status in the metadata document.
 *
 * Debounced at 500ms to avoid excessive writes during rapid source edits.
 */

import {useEffect, useRef} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient} from 'sanity'

import type {FieldCellState, FieldWorkflowStateEntry} from '../core/types'
import {findNewlyStaleEntries} from './deriveFieldCellStates'

/**
 * Sync newly-stale entries to the metadata document.
 *
 * @param cellStates - Current derived cell states
 * @param stateMap - Current metadata state map
 * @param metadataId - The metadata document ID
 * @param currentSourceValues - Current source values (for updating snapshot)
 */
export function useStaleSyncEffect(
  cellStates: Record<string, Record<string, FieldCellState>>,
  stateMap: Record<string, FieldWorkflowStateEntry>,
  metadataId: string,
  currentSourceValues: Record<string, string>,
): void {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use refs to avoid re-running effect on every render
  const cellStatesRef = useRef(cellStates)
  cellStatesRef.current = cellStates
  const stateMapRef = useRef(stateMap)
  stateMapRef.current = stateMap
  const sourceValuesRef = useRef(currentSourceValues)
  sourceValuesRef.current = currentSourceValues

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const newlyStale = findNewlyStaleEntries(cellStatesRef.current, stateMapRef.current)

      if (newlyStale.length === 0) return

      try {
        const tx = client.transaction()

        for (const {field, language} of newlyStale) {
          const key = `${field.replace(/\./g, '-')}--${language}`
          tx.patch(metadataId, (p) =>
            p.unset([`workflowStates[_key=="${key}"]`]).append('workflowStates', [
              {
                _key: key,
                field,
                language,
                status: 'stale',
                source: stateMapRef.current[`${field}::${language}`]?.source ?? 'ai',
                updatedAt: new Date().toISOString(),
                sourceSnapshot: stateMapRef.current[`${field}::${language}`]?.sourceSnapshot,
              },
            ]),
          )
        }

        await tx.commit()
      } catch (err) {
        // Non-critical — stale will be re-detected on next render
        console.warn('[l10n:field-stale-sync] Failed to persist stale entries:', err)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cellStates, client, metadataId])
}
