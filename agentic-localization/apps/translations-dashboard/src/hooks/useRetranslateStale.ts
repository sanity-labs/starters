/**
 * Hook for batch re-translating stale documents.
 *
 * Stale documents already have translations — they just need re-translating
 * because the source changed. Uses the same `agent.action.translate` API as
 * missing translations but with `targetDocument: {operation: 'edit', _id}`
 * to overwrite the existing translated document.
 *
 * Resolves translated document IDs from the aggregate metadata — the
 * translations[] array maps locale tags to document refs.
 *
 * Concurrency: processes MAX_CONCURRENT_TRANSLATIONS translations in parallel to avoid
 * rate limiting, matching the pattern in useBatchTranslationsWithProgress.
 */

import {useClient} from '@sanity/sdk-react'
import {useCallback, useState} from 'react'

import type {AggregateData} from './useTranslationAggregateData'

import {MAX_CONCURRENT_TRANSLATIONS} from '../consts/translation'
import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {buildMetadataLookup} from './useTranslationAggregateData'

// --- Types ---

export type RetranslateProgress = {
  completed: number
  failed: number
  total: number
}

export type RetranslateState = {
  error: Error | null
  isRetranslating: boolean
  progress: null | RetranslateProgress
}

export type RetranslateTarget = {
  /** Base document ID (source for translation) */
  baseDocId: string
  /** Locale display name (e.g., 'Mexican Spanish') */
  localeName: string
  /** Locale tag to re-translate (e.g., 'es-MX') */
  localeTag: string
}

// --- Hook ---

export function useRetranslateStale(aggregateData: AggregateData) {
  const {defaultLanguage, sanityClientConfig, translationsConfig} = useTranslationConfig()
  const client = useClient(sanityClientConfig)

  const [isRetranslating, setIsRetranslating] = useState(false)
  const [progress, setProgress] = useState<null | RetranslateProgress>(null)
  const [error, setError] = useState<Error | null>(null)

  const resolvedDefaultLanguage = defaultLanguage ?? 'en-US'

  const retranslateStale = useCallback(
    async (targets: RetranslateTarget[], targetReleaseId?: string) => {
      if (targets.length === 0) return

      // Use a perspective-configured client for translate calls when targeting a release.
      // Metadata fetches and patches stay on the default client.
      // Release perspective is [releaseId, 'drafts'] — the release layer with drafts fallback.
      const translateClient = targetReleaseId
        ? client.withConfig({perspective: [targetReleaseId, 'drafts']})
        : client

      setIsRetranslating(true)
      setError(null)
      setProgress({completed: 0, failed: 0, total: targets.length})

      const {baseDocuments, metadata} = aggregateData
      const metadataLookup = buildMetadataLookup(baseDocuments, metadata)

      let completed = 0
      let failed = 0

      // Process with concurrency limit
      const queue = [...targets]
      const workers = Array.from(
        {length: Math.min(MAX_CONCURRENT_TRANSLATIONS, queue.length)},
        async () => {
          while (queue.length > 0) {
            const target = queue.shift()
            if (!target) break

            try {
              // Find the translated document ID from metadata
              const meta = metadataLookup.get(target.baseDocId)
              const translationRef = meta?.translations?.find(
                (t) => t.language === target.localeTag,
              )

              if (!translationRef?.ref) {
                // No existing translation found — skip (shouldn't happen for stale docs)
                failed++
                setProgress({completed, failed, total: targets.length})
                continue
              }

              await translateClient.agent.action.translate({
                documentId: target.baseDocId,
                fromLanguage: {id: resolvedDefaultLanguage, title: resolvedDefaultLanguage},
                languageFieldPath: translationsConfig.languageField,
                schemaId: '_.schemas.default',
                targetDocument: {_id: translationRef.ref, operation: 'edit'},
                toLanguage: {id: target.localeTag, title: target.localeName},
              })

              // Update workflow state to needsReview after re-translation.
              // Include sourceRevision so the stale detection function knows
              // which source version this translation is based on. Without it,
              // the next source publish would immediately mark it stale again.
              // Pattern matches pane-side useTranslateActions (lines 244, 347).
              if (meta) {
                const sourceDoc = await client.fetch<{_rev: string} | null>(
                  `*[_id == $id][0]{ _rev }`,
                  {id: target.baseDocId},
                )

                await client
                  .patch(meta._id)
                  .setIfMissing({workflowStates: []})
                  .unset([`workflowStates[language=="${target.localeTag}"]`])
                  .append('workflowStates', [
                    {
                      language: target.localeTag,
                      source: 'ai',
                      sourceRevision: sourceDoc?._rev,
                      status: 'needsReview',
                      updatedAt: new Date().toISOString(),
                    },
                  ])
                  .commit()
              }

              completed++
            } catch (err) {
              console.error(
                `[RetranslateStale] Failed to re-translate ${target.baseDocId} → ${target.localeTag}:`,
                err,
              )
              failed++
            }

            setProgress({completed, failed, total: targets.length})
          }
        },
      )

      await Promise.all(workers)

      setIsRetranslating(false)

      if (failed > 0 && failed === targets.length) {
        setError(new Error(`All ${failed} re-translations failed`))
      } else if (failed > 0) {
        setError(new Error(`${failed} of ${targets.length} re-translations failed`))
      }
    },
    [aggregateData, client, resolvedDefaultLanguage, translationsConfig.languageField],
  )

  return {
    error,
    isRetranslating,
    progress,
    retranslateStale,
  }
}
