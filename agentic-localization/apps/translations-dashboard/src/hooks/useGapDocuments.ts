/**
 * Derived hook: Gap-closer document list for the Translations route.
 *
 * "12 articles need translation in Mexican Spanish" — the documents whose
 * status for one locale is missing, fallback-only, or stale, sorted by
 * actionability (published sources first). Documents already inside an open run
 * stay in the list carrying it, so the row shows progress instead of a CTA.
 */

import {useMemo} from 'react'

import type {DashboardStatus} from '../lib/localizationRun'

import {resolveLocaleStatus} from '../lib/localizationRun'
import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildTranslationMap,
} from './useTranslationAggregateData'

// --- Types ---

export type GapDocument = {
  documentId: string
  /** Needed to derive the run's idempotency key when starting one. */
  documentRev: string
  documentType: string
  /** The open run covering this locale, if any. */
  instanceId: null | string
  /** Source document publish status */
  sourceStatus: 'draft' | 'inRelease' | 'published' | 'unknown'
  title: null | string
  /** Why this document is a gap */
  workflowStatus: DashboardStatus
}

export type GapDocumentsData = {
  /** Documents sorted by actionability (published first) */
  documents: GapDocument[]
  sourceBreakdown: {
    draft: number
    inRelease: number
    published: number
    unknown: number
  }
  totalMissing: number
  workflowBreakdown: {
    missing: number
    stale: number
    translating: number
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

/** Statuses that represent a gap needing action, or work already under way on one. */
const GAP_STATUSES = new Set<DashboardStatus>(['missing', 'stale', 'translating', 'usingFallback'])

// --- Hook ---

export function useGapDocuments(
  aggregateData: AggregateData,
  docType: null | string,
  locale: null | string,
): GapDocumentsData | null {
  return useMemo(() => {
    if (!docType || !locale) return null

    const {baseDocuments, locales, metadata, runs} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    const typeDocs = baseDocuments.filter((d) => d._type === docType)
    const gapDocuments: GapDocument[] = []

    for (const doc of typeDocs) {
      const translations = buildTranslationMap(metadataLookup.get(doc._id))
      const fallbackTag = fallbackMap.get(locale)

      const resolved = resolveLocaleStatus({
        fallbackTranslated: Boolean(fallbackTag && translations.get(fallbackTag)?.ref),
        localeTag: locale,
        run: runs.get(doc._id),
        translated: Boolean(translations.get(locale)?.ref),
      })

      if (!GAP_STATUSES.has(resolved.status)) continue

      const sourceStatus = inferSourceStatus(doc._id)
      if (sourceStatus === 'unknown') continue

      gapDocuments.push({
        documentId: doc._id,
        documentRev: doc._rev,
        documentType: doc._type,
        instanceId: resolved.instanceId,
        sourceStatus,
        title: doc.title,
        workflowStatus: resolved.status,
      })
    }

    // Published first — the most valuable to translate
    gapDocuments.sort(
      (a, b) => SOURCE_STATUS_ORDER[a.sourceStatus] - SOURCE_STATUS_ORDER[b.sourceStatus],
    )

    const sourceBreakdown = {draft: 0, inRelease: 0, published: 0, unknown: 0}
    const workflowBreakdown = {missing: 0, stale: 0, translating: 0, usingFallback: 0}
    for (const doc of gapDocuments) {
      sourceBreakdown[doc.sourceStatus]++
      const status = doc.workflowStatus
      if (
        status === 'missing' ||
        status === 'stale' ||
        status === 'translating' ||
        status === 'usingFallback'
      ) {
        workflowBreakdown[status]++
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
 * The aggregate query reads raw, so ids arrive as written: `drafts.xxx`
 * (draft only), `versions.<release>.xxx` (in a release), plain (published).
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
