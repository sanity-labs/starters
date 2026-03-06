/**
 * Hook that reads pre-computed AI stale analysis from the metadata document.
 *
 * Common path (function already ran): instant cache read, no loading state.
 * Rare path (editor beats the function): triggers client-side analysis pipeline
 * and writes results to metadata for future reads.
 *
 * The hook receives the metadata doc from useTranslationPaneData (already fetched)
 * — it does NOT re-fetch. The staleAnalysis field is added to the metadata projection.
 */

import {useCallback, useEffect, useRef, useState, useTransition} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, usePerspective} from 'sanity'

import {diffWords} from 'diff'
import {buildFieldSummary, type TextExtracts} from '../core/buildFieldSummary'
import {extractBlockText} from '../core/extractBlockText'
import {getValidAnalysis, isAnalysisFresh, writeAnalysisCache} from '../core/staleAnalysisCache'
import {sanitizeTranslationValue} from '../core/sanitizeTranslationValue'
import {ANALYSIS_PROMPT_INSTRUCTION} from '../core/staleAnalysisPrompt'
import type {
  PreTranslatedSuggestion,
  StaleAnalysisCache,
  StaleAnalysisResult,
  StaleAnalysisSuggestion,
} from '../core/types'
import {computeFieldChanges, type FieldChange} from '../core/computeFieldChanges'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseStaleAIAnalysisResult {
  /** Whether analysis is loading (rare — only when editor beats the function) */
  isLoading: boolean
  /** The AI analysis result (null if not yet available) */
  analysis: StaleAnalysisResult | null
  /** Pre-translations for the CURRENT locale only (filtered from all-locale cache) */
  preTranslations: PreTranslatedSuggestion[]
  /** Error if analysis failed */
  error: Error | null
  /** Retry the analysis (clears error, re-runs fallback) */
  retry: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPTText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(extractBlockText).filter(Boolean).join(' ')
}

function buildTextExtractsFromChanges(changes: FieldChange[]): TextExtracts {
  const extracts: TextExtracts = {}
  for (const c of changes) {
    if (c.fieldType === 'portableText' && c.changed) {
      extracts[c.fieldName] = {
        oldText: extractPTText(c.oldValue),
        newText: extractPTText(c.newValue),
      }
    }
  }
  return extracts
}

function parseAnalysisResponse(raw: string, validFieldNames: Set<string>): StaleAnalysisResult {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
  const parsed = JSON.parse(cleaned)

  if (!parsed.materiality || !parsed.suggestions || !parsed.explanation) {
    throw new Error('AI response missing required fields')
  }

  if (!['cosmetic', 'minor', 'material'].includes(parsed.materiality)) {
    throw new Error(`Invalid materiality: ${parsed.materiality}`)
  }

  const validSuggestions: StaleAnalysisSuggestion[] = parsed.suggestions
    .filter((s: {fieldName?: string}) => s.fieldName && validFieldNames.has(s.fieldName))
    .map(
      (s: {
        fieldName: string
        explanation: string
        recommendation: string
        changeSummary?: string
        reasonCode?: string
        impactTags?: string[]
      }) => ({
        fieldName: s.fieldName,
        explanation: s.explanation || '',
        recommendation: s.recommendation === 'retranslate' ? 'retranslate' : ('dismiss' as const),
        ...(s.changeSummary && {changeSummary: s.changeSummary}),
        ...(s.reasonCode && {reasonCode: s.reasonCode}),
        ...(s.impactTags?.length && {impactTags: s.impactTags}),
      }),
    )

  const droppedCount = parsed.suggestions.length - validSuggestions.length

  return {
    explanation: parsed.explanation,
    materiality: parsed.materiality,
    suggestions: validSuggestions,
    droppedSuggestionCount: droppedCount > 0 ? droppedCount : undefined,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStaleAIAnalysis(
  /** Cached stale analysis from metadata doc (via useTranslationPaneData) */
  staleAnalysis: StaleAnalysisCache | null,
  /** Current staleSourceRev from the workflow state entry */
  staleSourceRev: string | undefined,
  /** Current locale ID (for filtering pre-translations) */
  localeId: string,
  /** Source document published ID (for fallback pipeline) */
  sourceDocPublishedId: string | undefined,
  /** Source revision at translation time (for History API fetch in fallback) */
  sourceRevision: string | undefined,
  /** Metadata document ID (for writing fallback results) */
  metadataId: string | null,
  /** Whether to enable (false = skip, return empty state) */
  enabled: boolean,
): UseStaleAIAnalysisResult {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const agentClient = useClient({apiVersion: 'vX'})
  const {perspectiveStack} = usePerspective()

  const [isPending, startFallbackTransition] = useTransition()
  const [fallbackResult, setFallbackResult] = useState<{
    analysis: StaleAnalysisResult
    preTranslations: PreTranslatedSuggestion[]
  } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Track whether fallback has been attempted for this staleSourceRev
  const attemptedRevRef = useRef<string | null>(null)

  // --- Common path: cache read ---
  const cachedResult = staleSourceRev ? getValidAnalysis(staleAnalysis, staleSourceRev) : null

  // Filter pre-translations to current locale
  const cachedPreTranslations =
    cachedResult?.preTranslations?.filter((pt) => pt.localeId === localeId) ?? []

  // --- Rare path: client-side fallback ---
  useEffect(() => {
    if (!enabled || !staleSourceRev || !sourceDocPublishedId || !sourceRevision || !metadataId) {
      return
    }

    // Already have valid cache — no fallback needed
    if (cachedResult) {
      return
    }

    // Already attempted for this rev (unless retrying)
    if (attemptedRevRef.current === `${staleSourceRev}-${retryCount}`) {
      return
    }
    attemptedRevRef.current = `${staleSourceRev}-${retryCount}`

    // Check freshness — function might be running right now
    if (isAnalysisFresh(staleAnalysis, staleSourceRev)) {
      return
    }

    let cancelled = false

    setError(null)
    startFallbackTransition(async () => {
      try {
        // Fetch historical + current source docs
        const dataset = client.config().dataset ?? 'production'
        const [histResponse, currentDoc] = await Promise.all([
          client.request<{documents?: Array<Record<string, unknown>>}>({
            url: `/data/history/${dataset}/documents/${sourceDocPublishedId}?revision=${sourceRevision}`,
          }),
          client.fetch<Record<string, unknown> | null>(
            `*[_id == $id][0]`,
            {id: sourceDocPublishedId},
            {perspective: perspectiveStack},
          ),
        ])

        if (cancelled) return

        const historicalDoc = histResponse?.documents?.[0] ?? null
        if (!historicalDoc || !currentDoc) {
          throw new Error('Could not fetch document versions for comparison')
        }

        // Compute field diff
        const fieldChanges = computeFieldChanges(historicalDoc, currentDoc)
        const changedFields = fieldChanges.filter((f) => f.changed)

        if (changedFields.length === 0) {
          const emptyResult: StaleAnalysisResult = {
            explanation:
              'No meaningful changes detected between document versions. The content appears identical.',
            materiality: 'cosmetic',
            suggestions: [],
          }
          if (!cancelled) {
            setFallbackResult({analysis: emptyResult, preTranslations: []})
          }
          // Write to cache so function doesn't duplicate
          await writeAnalysisCache(client, metadataId, staleSourceRev, emptyResult, [])
          return
        }

        const textExtracts = buildTextExtractsFromChanges(fieldChanges)
        const fieldSummary = buildFieldSummary(fieldChanges, textExtracts, diffWords)
        const validFieldNames = new Set(changedFields.map((f) => f.fieldName))

        // AI analysis
        const promptInstruction = ANALYSIS_PROMPT_INSTRUCTION.replace('$fieldSummary', fieldSummary)
        const response = await agentClient.agent.action.prompt({
          instruction: promptInstruction,
        })

        if (cancelled) return

        const analysisResult = parseAnalysisResponse(response, validFieldNames)

        // Pre-translate for THIS locale only (client fallback is locale-scoped)
        const fieldsToTranslate = analysisResult.suggestions
          .filter((s) => s.recommendation === 'retranslate')
          .map((s) => s.fieldName)

        const preTranslations: PreTranslatedSuggestion[] = []

        for (const fieldName of fieldsToTranslate) {
          if (cancelled) return
          try {
            const result = await agentClient.agent.action.translate({
              documentId: sourceDocPublishedId,
              fromLanguage: {id: 'en-US', title: 'English (US)'},
              languageFieldPath: 'language',
              noWrite: true,
              schemaId: '_.schemas.default',
              target: {include: [fieldName]},
              targetDocument: {operation: 'create'},
              toLanguage: {id: localeId, title: localeId},
            })

            if (result && result[fieldName] !== undefined) {
              preTranslations.push({
                fieldName,
                localeId,
                suggestedValue: sanitizeTranslationValue(result[fieldName]),
              })
            }
          } catch {
            // Continue — partial results are better than none
          }
        }

        if (cancelled) return

        setFallbackResult({analysis: analysisResult, preTranslations})

        // Write to cache so function doesn't duplicate and other locales benefit
        await writeAnalysisCache(
          client,
          metadataId,
          staleSourceRev,
          analysisResult,
          preTranslations,
        ).catch(() => {
          // Non-critical — cache write failure doesn't affect the UI
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    staleSourceRev,
    sourceDocPublishedId,
    sourceRevision,
    metadataId,
    cachedResult,
    staleAnalysis,
    retryCount,
    client,
    agentClient,
    perspectiveStack,
    localeId,
  ])

  const retry = useCallback(() => {
    setError(null)
    setFallbackResult(null)
    setRetryCount((c) => c + 1)
  }, [])

  // Prefer cached result over fallback
  if (cachedResult) {
    return {
      isLoading: false,
      analysis: cachedResult.result,
      preTranslations: cachedPreTranslations,
      error: null,
      retry,
    }
  }

  if (fallbackResult) {
    return {
      isLoading: false,
      analysis: fallbackResult.analysis,
      preTranslations: fallbackResult.preTranslations,
      error: null,
      retry,
    }
  }

  return {
    isLoading: isPending,
    analysis: null,
    preTranslations: [],
    error,
    retry,
  }
}
