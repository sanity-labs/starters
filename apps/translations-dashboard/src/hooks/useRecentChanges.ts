/**
 * Derived hook: Recent translation changes for the dashboard.
 *
 * Flattens workflowStates[] entries across all metadata documents,
 * sorted by updatedAt descending. Shows the most recently touched translations.
 *
 * Optional userId filter for "Your Activity" tab. When provided,
 * only returns entries where reviewedBy matches the user. Limitation: only
 * captures approvals/reviews, not who initiated AI translations (no translatedBy
 * field yet).
 *
 * This is NOT a true activity feed — workflowStates stores current state per
 * locale (overwrite, not append). Each entry represents "the latest action
 * for this locale of this document," not a history of all actions.
 *
 * Data source: AggregateData.metadata[].workflowStates[]
 * Each entry has: _key (locale), status, source?, updatedAt?, reviewedBy?
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'

import {useMemo} from 'react'

import type {AggregateData, AggregateLocale} from './useTranslationAggregateData'

// --- Types ---

export type RecentChangeEntry = {
  /** Base document ID (derived from metadata → translations lookup) */
  documentId: null | string
  /** Document title (null if untitled or unresolvable) */
  documentTitle: null | string
  /** Document type (if resolvable) */
  documentType: null | string
  /** Locale flag emoji */
  localeFlag: string
  /** Locale display name */
  localeName: string
  /** Locale tag (e.g., 'es-MX') */
  localeTag: string
  /** Who reviewed/approved (if available) */
  reviewedBy: null | string
  /** How the translation was created: 'ai' | 'manual' */
  source: 'ai' | 'manual' | null
  /** Current workflow status */
  status: TranslationWorkflowStatus
  /** When this state was last updated */
  updatedAt: string
}

// --- Hook ---

const DEFAULT_LIMIT = 20

/**
 * @param aggregateData - The shared aggregate data
 * @param limit - Max entries to return (default: 20)
 * @param userId - Optional user ID filter for "Your Activity" tab.
 *   When provided, only returns entries where reviewedBy matches the user.
 *   Limitation: only captures approvals/reviews, not who initiated AI translations.
 */
export function useRecentChanges(
  aggregateData: AggregateData,
  limit: number = DEFAULT_LIMIT,
  userId?: null | string,
): RecentChangeEntry[] {
  return useMemo(() => {
    const {baseDocuments, locales, metadata} = aggregateData

    // Build locale lookup for display info
    const localeLookup = new Map<string, AggregateLocale>()
    for (const locale of locales) {
      localeLookup.set(locale.tag, locale)
    }

    // Build reverse lookup: metadata._id → base document info
    // A metadata doc's translations[] contains refs to both the base doc and translations.
    // We need to find which base document each metadata doc belongs to.
    const baseDocIds = new Set(baseDocuments.map((d) => d._id))
    const baseDocLookup = new Map<string, {_id: string; _type: string; title: null | string}>()
    for (const doc of baseDocuments) {
      baseDocLookup.set(doc._id, doc)
    }

    const metadataToBaseDoc = new Map<string, {_id: string; _type: string; title: null | string}>()
    for (const meta of metadata) {
      if (!meta.translations) continue
      for (const t of meta.translations) {
        if (baseDocIds.has(t.ref)) {
          const baseDoc = baseDocLookup.get(t.ref)
          if (baseDoc) {
            metadataToBaseDoc.set(meta._id, baseDoc)
          }
          break
        }
      }
    }

    // Flatten all workflowStates entries with updatedAt
    const entries: RecentChangeEntry[] = []

    for (const meta of metadata) {
      if (!meta.workflowStates) continue

      const baseDoc = metadataToBaseDoc.get(meta._id)

      for (const ws of meta.workflowStates) {
        // Skip entries without updatedAt — they can't be sorted chronologically
        if (!ws.updatedAt) continue

        const locale = localeLookup.get(ws._key)

        entries.push({
          documentId: baseDoc?._id ?? null,
          documentTitle: baseDoc?.title ?? null,
          documentType: baseDoc?._type ?? null,
          localeFlag: locale?.flag ?? '',
          localeName: locale?.title ?? ws._key,
          localeTag: ws._key,
          reviewedBy: ws.reviewedBy ?? null,
          source: ws.source ?? null,
          status: ws.status,
          updatedAt: ws.updatedAt,
        })
      }
    }

    // Filter by userId if provided ("Your Activity" tab)
    const filtered = userId ? entries.filter((e) => e.reviewedBy === userId) : entries

    // Sort by updatedAt descending (most recent first)
    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    // Return top N
    return filtered.slice(0, limit)
  }, [aggregateData, limit, userId])
}
