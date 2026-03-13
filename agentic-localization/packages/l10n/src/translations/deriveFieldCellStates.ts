/**
 * Pure function: merge document snapshot + workflow metadata → FieldCellState matrix.
 *
 * Status derivation rules:
 * 1. No array entry → `missing`
 * 2. Entry exists, no metadata → `approved` (implicit — manual/pre-existing)
 * 3. Entry exists, metadata `needsReview`, source unchanged → `needsReview`
 * 4. Entry exists, metadata `needsReview` or `approved`, source changed → `stale`
 * 5. Entry exists, metadata `stale` → `stale`
 * 6. Entry exists, metadata `approved`, source unchanged → `approved`
 */

import type {FieldCellState, FieldWorkflowStateEntry} from '../core/types'
import type {FieldTranslationSnapshot} from './useFieldTranslationData'

/**
 * Derive the full FieldCellState matrix from document snapshot and workflow metadata.
 *
 * @param snapshot - Current field translation snapshot (filled/empty + source values)
 * @param stateMap - Workflow metadata keyed by `field::language`
 * @param currentSourceValues - Current source values keyed by field displayPath
 * @returns Matrix of `Record<fieldPath, Record<localeId, FieldCellState>>`
 */
export function deriveFieldCellStates(
  snapshot: FieldTranslationSnapshot,
  stateMap: Record<string, FieldWorkflowStateEntry>,
  currentSourceValues: Record<string, string>,
): Record<string, Record<string, FieldCellState>> {
  const result: Record<string, Record<string, FieldCellState>> = {}

  for (const [fieldPath, localeStatuses] of Object.entries(snapshot.matrix)) {
    const sourceLocale = snapshot.sourceLanguages[fieldPath]
    const fieldStates: Record<string, FieldCellState> = {}

    for (const [localeId, docStatus] of Object.entries(localeStatuses)) {
      // Source locale is always implicitly approved
      if (localeId === sourceLocale) {
        fieldStates[localeId] = {status: 'approved', source: 'manual'}
        continue
      }

      // Rule 1: No array entry → missing
      if (docStatus === 'empty') {
        fieldStates[localeId] = {status: 'missing'}
        continue
      }

      // Entry exists — check metadata
      const key = `${fieldPath}::${localeId}`
      const meta = stateMap[key]

      if (!meta) {
        // Rule 2: No metadata → approved (implicit)
        fieldStates[localeId] = {status: 'approved'}
        continue
      }

      // Check for staleness: compare current source value to stored snapshot
      const currentSource = currentSourceValues[fieldPath]
      const isSourceChanged = meta.sourceSnapshot != null && currentSource !== meta.sourceSnapshot

      if (meta.status === 'stale') {
        // Rule 5: Already marked stale
        fieldStates[localeId] = {
          status: 'stale',
          source: meta.source,
          sourceSnapshot: meta.sourceSnapshot,
          reviewedBy: meta.reviewedBy,
          updatedAt: meta.updatedAt,
        }
      } else if (isSourceChanged) {
        // Rule 4: Source changed → stale (regardless of current metadata status)
        fieldStates[localeId] = {
          status: 'stale',
          source: meta.source,
          sourceSnapshot: meta.sourceSnapshot,
          reviewedBy: meta.reviewedBy,
          updatedAt: meta.updatedAt,
        }
      } else if (meta.status === 'needsReview') {
        // Rule 3: needsReview, source unchanged
        fieldStates[localeId] = {
          status: 'needsReview',
          source: meta.source,
          sourceSnapshot: meta.sourceSnapshot,
          updatedAt: meta.updatedAt,
        }
      } else {
        // Rule 6: approved, source unchanged
        fieldStates[localeId] = {
          status: 'approved',
          source: meta.source,
          reviewedBy: meta.reviewedBy,
          updatedAt: meta.updatedAt,
        }
      }
    }

    result[fieldPath] = fieldStates
  }

  return result
}

/**
 * Find entries that are newly stale (detected client-side but not yet persisted).
 * Returns entries that need to be patched to metadata.
 */
export function findNewlyStaleEntries(
  cellStates: Record<string, Record<string, FieldCellState>>,
  stateMap: Record<string, FieldWorkflowStateEntry>,
): Array<{field: string; language: string}> {
  const newlyStale: Array<{field: string; language: string}> = []

  for (const [fieldPath, localeStates] of Object.entries(cellStates)) {
    for (const [localeId, cellState] of Object.entries(localeStates)) {
      if (cellState.status !== 'stale') continue

      const key = `${fieldPath}::${localeId}`
      const meta = stateMap[key]

      // Only "newly stale" if metadata exists but isn't already marked stale
      if (meta && meta.status !== 'stale') {
        newlyStale.push({field: fieldPath, language: localeId})
      }
    }
  }

  return newlyStale
}
