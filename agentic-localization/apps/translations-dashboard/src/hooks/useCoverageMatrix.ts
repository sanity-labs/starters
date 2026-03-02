/**
 * Derived hook: Coverage matrix for the heatmap.
 *
 * Produces a document type × locale matrix showing translation coverage.
 * Each cell has counts by workflow status and a coverage percentage for coloring.
 *
 * Heatmap metric: "has direct translation" (not "what's approved?").
 * The heatmap answers "where are the gaps?"
 *
 * Three-color heatmap:
 * - Red (critical): missing — no content at all
 * - Yellow (caution): usingFallback — covered by fallback, no direct translation
 * - Green (positive): needsReview + approved + stale — has direct translation content
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'

import {useMemo} from 'react'

import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildWorkflowStateMap,
  resolveWorkflowStatus,
} from './useTranslationAggregateData'

// --- Types ---

export type CoverageCell = {
  /** Approved translations (ready for launch) */
  approved: number
  /** Missing translations (no content at all) */
  missing: number
  /** Translations pending human review */
  needsReview: number
  /** Coverage percentage: (needsReview + approved + stale) / total * 100 — "has direct translation" */
  percentage: number
  /** Stale translations (source changed) */
  stale: number
  /** Total documents */
  total: number
  /** Translations covered by fallback */
  usingFallback: number
}

export type CoverageMatrixRow = {
  /** Document type identifier */
  documentType: string
  /** Human-readable document type label */
  documentTypeLabel: string
  /** Per-locale coverage data */
  locales: Record<string, CoverageCell>
}

export type CoverageMatrixResult = {
  data: CoverageMatrixRow[]
  /** Locale list in display order */
  localeColumns: Array<{flag: string; tag: string; title: string}>
}

// --- Document type labels ---
// TODO: These should come from schema metadata, not hardcoded
const DOC_TYPE_LABELS: Record<string, string> = {
  article: 'Articles',
}

export function useCoverageMatrix(aggregateData: AggregateData): CoverageMatrixResult {
  const {translationsConfig} = useTranslationConfig()

  return useMemo(() => {
    const {baseDocuments, locales, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    // Group base documents by type
    const docsByType = new Map<string, typeof baseDocuments>()
    for (const doc of baseDocuments) {
      const existing = docsByType.get(doc._type) || []
      existing.push(doc)
      docsByType.set(doc._type, existing)
    }

    // Build matrix rows — one per configured document type that has documents
    const rows: CoverageMatrixRow[] = translationsConfig.internationalizedTypes
      .filter((type) => docsByType.has(type))
      .map((docType): CoverageMatrixRow => {
        const docs = docsByType.get(docType) || []
        const localeData: Record<string, CoverageCell> = {}

        for (const locale of locales) {
          const counts: Record<TranslationWorkflowStatus, number> = {
            approved: 0,
            missing: 0,
            needsReview: 0,
            stale: 0,
            usingFallback: 0,
          }

          for (const doc of docs) {
            const meta = metadataLookup.get(doc._id)
            const translationMap = new Map<
              string,
              NonNullable<typeof meta>['translations'][number]
            >()
            const workflowStateMap = buildWorkflowStateMap(meta?.workflowStates ?? null)

            if (meta?.translations) {
              for (const t of meta.translations) {
                translationMap.set(t._key, t)
              }
            }

            const translation = translationMap.get(locale.tag)
            const fallbackTag = fallbackMap.get(locale.tag)
            const fallbackTranslation = fallbackTag ? translationMap.get(fallbackTag) : undefined

            const status = resolveWorkflowStatus(
              locale.tag,
              workflowStateMap,
              translation,
              fallbackTranslation,
            )
            counts[status]++
          }

          const total = docs.length
          localeData[locale.tag] = {
            approved: counts.approved,
            missing: counts.missing,
            needsReview: counts.needsReview,
            percentage:
              total > 0
                ? Math.round(((counts.needsReview + counts.approved + counts.stale) / total) * 100)
                : 0,
            stale: counts.stale,
            total,
            usingFallback: counts.usingFallback,
          }
        }

        return {
          documentType: docType,
          documentTypeLabel: getDocTypeLabel(docType),
          locales: localeData,
        }
      })

    const localeColumns = locales.map((l) => ({
      flag: l.flag,
      tag: l.tag,
      title: l.title,
    }))

    return {data: rows, localeColumns}
  }, [aggregateData, translationsConfig.internationalizedTypes])
}

// --- Hook ---

function getDocTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1)
}
