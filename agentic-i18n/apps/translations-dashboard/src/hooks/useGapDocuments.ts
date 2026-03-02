/**
 * Derived hook: Gap-closer document list for the Translations route.
 *
 * Given a document type and locale, identifies which base documents are
 * missing translations for that locale and fetches their source publish
 * status. Returns documents sorted by actionability (published first,
 * then in-release, then draft).
 *
 * A document is a "gap" if its workflow status is 'missing' or 'usingFallback' —
 * both need direct translations. 'stale' documents are also gaps since
 * they need re-translation.
 *
 * Powers the gap-closer action view — "12 articles need
 * translation in Mexican Spanish."
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'

import {useMemo} from 'react'

import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildWorkflowStateMap,
  resolveWorkflowStatus,
} from './useTranslationAggregateData'

// --- Types ---

export type GapDocument = {
  /** Base document ID */
  documentId: string
  /** Document type */
  documentType: string
  /** Source document publish status */
  sourceStatus: 'draft' | 'inRelease' | 'published' | 'unknown'
  /** Document title (null if untitled) */
  title: null | string
  /** Why this document is a gap */
  workflowStatus: TranslationWorkflowStatus
}

export type GapDocumentsData = {
  /** Documents sorted by actionability (published first) */
  documents: GapDocument[]
  /** Source status breakdown counts */
  sourceBreakdown: {
    draft: number
    inRelease: number
    published: number
    unknown: number
  }
  /** Total gap documents for this type+locale */
  totalMissing: number
  /** Breakdown by workflow status */
  workflowBreakdown: {
    missing: number
    stale: number
    usingFallback: number
  }
}

// --- Source status priority for sorting ---
const SOURCE_STATUS_ORDER: Record<GapDocument['sourceStatus'], number> = {
  draft: 2,
  inRelease: 1,
  published: 0,
  unknown: 3,
}

/** Workflow statuses that represent a "gap" needing action */
const GAP_STATUSES = new Set<TranslationWorkflowStatus>(['missing', 'usingFallback', 'stale'])

// --- Hook ---

/**
 * @param aggregateData - The shared aggregate data
 * @param docType - Document type to filter (e.g., 'article')
 * @param locale - Locale tag to check for missing translations (e.g., 'es-MX')
 */
export function useGapDocuments(
  aggregateData: AggregateData,
  docType: null | string,
  locale: null | string,
): GapDocumentsData | null {
  return useMemo(() => {
    if (!docType || !locale) return null

    const {baseDocuments, locales, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    // Filter base documents by type
    const typeDocs = baseDocuments.filter((d) => d._type === docType)

    // Find documents that are gaps for this locale
    const gapDocuments: GapDocument[] = []

    for (const doc of typeDocs) {
      const meta = metadataLookup.get(doc._id)
      const translationMap = new Map<string, {_key: string; ref: string}>()
      const workflowStateMap = buildWorkflowStateMap(meta?.workflowStates ?? null)

      if (meta?.translations) {
        for (const t of meta.translations) {
          translationMap.set(t._key, t)
        }
      }

      const translation = translationMap.get(locale)
      const fallbackTag = fallbackMap.get(locale)
      const fallbackTranslation = fallbackTag ? translationMap.get(fallbackTag) : undefined

      const workflowStatus = resolveWorkflowStatus(
        locale,
        workflowStateMap,
        translation,
        fallbackTranslation,
      )

      if (!GAP_STATUSES.has(workflowStatus)) {
        // Not a gap — approved or needsReview translations don't need action here
        continue
      }

      const sourceStatus = inferSourceStatus(doc._id)
      if (sourceStatus === 'unknown') continue

      gapDocuments.push({
        documentId: doc._id,
        documentType: doc._type,
        sourceStatus,
        title: doc.title,
        workflowStatus,
      })
    }

    // Sort by actionability: published first (most valuable to translate)
    // Key is guaranteed valid — GapDocument['sourceStatus'] matches SOURCE_STATUS_ORDER keys
    gapDocuments.sort(
      (a, b) => SOURCE_STATUS_ORDER[a.sourceStatus] - SOURCE_STATUS_ORDER[b.sourceStatus],
    )

    // Compute source status breakdown
    const sourceBreakdown = {draft: 0, inRelease: 0, published: 0, unknown: 0}
    const workflowBreakdown = {missing: 0, stale: 0, usingFallback: 0}
    for (const doc of gapDocuments) {
      sourceBreakdown[doc.sourceStatus]++
      if (
        doc.workflowStatus === 'missing' ||
        doc.workflowStatus === 'usingFallback' ||
        doc.workflowStatus === 'stale'
      ) {
        workflowBreakdown[doc.workflowStatus]++
      }
    }

    return {
      documents: gapDocuments,
      sourceBreakdown,
      totalMissing: gapDocuments.length,
      workflowBreakdown,
    }
  }, [aggregateData, docType, locale])
}

// --- Utilities ---

/**
 * Infer source document publish status from its ID.
 *
 * The aggregate query uses perspective: 'raw', which returns documents
 * with their actual IDs:
 *   - "drafts.xxx" = draft only (no published version)
 *   - "versions.releaseId.xxx" = in a release
 *   - "xxx" (plain) = published
 *
 * Note: With perspective: 'raw', a document that has BOTH a published
 * and draft version appears as the published ID. The draft is a separate
 * document. So a plain ID reliably means "has published version."
 */
function inferSourceStatus(documentId: string): 'draft' | 'inRelease' | 'published' | 'unknown' {
  if (documentId.startsWith('drafts.')) return 'draft'
  if (documentId.startsWith('versions.')) {
    const releaseId = documentId.split('.')[1]
    if (releaseId?.startsWith('agent-')) return 'unknown'
    return 'inRelease'
  }
  return 'published'
}
