/**
 * Cache read/write/freshness helpers for AI stale change analysis.
 *
 * The `staleAnalysis` field on `translation.metadata` stores the AI analysis
 * result + pre-computed translations. These helpers are shared by:
 * - The Sanity Function (T2) that writes the cache after stale marking
 * - The client-side hook (T3) that reads the cache (and falls back to client-side analysis)
 */

import type {SanityClient} from '@sanity/client'

import type {
  PreTranslatedSuggestion,
  ReviewProgress,
  StaleAnalysisCache,
  StaleAnalysisResult,
} from './types'

/** Freshness window — skip re-analysis if cache is this recent. */
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if cached analysis is valid for the current stale state.
 * Returns the cached analysis if `sourceRevision` matches, null otherwise.
 *
 * This is the primary cache check — used by both the function (guard against
 * re-running) and the client hook (instant read vs fallback).
 */
export function getValidAnalysis(
  cache: StaleAnalysisCache | null | undefined,
  currentStaleSourceRev: string,
): StaleAnalysisCache | null {
  if (!cache) return null
  if (cache.sourceRevision !== currentStaleSourceRev) return null
  return cache
}

/**
 * Check if analysis is fresh enough to skip re-running.
 *
 * Stricter than `getValidAnalysis` — also checks the time window.
 * Used by the Sanity Function to guard against:
 * 1. Infinite loops (function writes → triggers itself → freshness guard skips)
 * 2. Duplicate work from rapid re-publishes
 * 3. Client/function race conditions
 */
export function isAnalysisFresh(
  cache: StaleAnalysisCache | null | undefined,
  currentStaleSourceRev: string,
): boolean {
  if (!cache || cache.sourceRevision !== currentStaleSourceRev) return false
  const age = Date.now() - new Date(cache.analyzedAt).getTime()
  return age < FRESHNESS_WINDOW_MS
}

/**
 * Write analysis + pre-translations to the metadata document.
 *
 * Uses `set()` on the top-level `staleAnalysis` field. This is a full replace —
 * any previous analysis is overwritten. The `sourceRevision` field acts as the
 * cache key for subsequent reads.
 */
export async function writeAnalysisCache(
  client: SanityClient,
  metadataId: string,
  staleSourceRev: string,
  result: StaleAnalysisResult,
  preTranslations: PreTranslatedSuggestion[],
): Promise<void> {
  const cache: StaleAnalysisCache = {
    sourceRevision: staleSourceRev,
    analyzedAt: new Date().toISOString(),
    result,
    preTranslations,
  }
  await client.patch(metadataId).set({staleAnalysis: cache}).commit()
}

/**
 * Read persisted review progress for a specific locale from the cache.
 * Returns the `fields` record if the `sourceRevision` matches, `null` otherwise.
 *
 * Entries are keyed by `${sourceRevision}--${localeId}` via the `_key` field.
 */
export function getReviewProgress(
  cache: StaleAnalysisCache | null | undefined,
  currentStaleSourceRev: string,
  localeId: string,
): Record<string, 'applied' | 'skipped'> | null {
  if (!cache || cache.sourceRevision !== currentStaleSourceRev) return null
  const progressKey = `${currentStaleSourceRev}--${localeId}`
  const entry = cache.reviewProgress?.find((rp) => rp._key === progressKey)
  return entry?.fields ?? null
}

/**
 * Persist per-field review decisions for a locale on the metadata document.
 *
 * Uses atomic Sanity array patch operations (unset + append) instead of
 * read-modify-write, preventing concurrent editors from overwriting each other.
 *
 * Fire-and-forget — callers should NOT await this; UI state is updated
 * optimistically via React state.
 */
export async function writeReviewProgress(
  client: SanityClient,
  metadataId: string,
  staleSourceRev: string,
  localeId: string,
  fields: Record<string, 'applied' | 'skipped'>,
): Promise<void> {
  const progressKey = `${staleSourceRev}--${localeId}`
  const entry: ReviewProgress = {
    _key: progressKey,
    sourceRevision: staleSourceRev,
    localeId,
    fields,
  }

  await client
    .patch(metadataId)
    .setIfMissing({'staleAnalysis.reviewProgress': []})
    .unset([`staleAnalysis.reviewProgress[_key=="${progressKey}"]`])
    .append('staleAnalysis.reviewProgress', [entry])
    .commit({autoGenerateArrayKeys: true})
}
