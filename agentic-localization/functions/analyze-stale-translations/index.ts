/**
 * Sanity Function: Analyze stale translations and pre-translate changed fields.
 *
 * Chains after mark-translations-stale: triggers on translation.metadata mutations
 * where workflowStates contain stale entries. Runs AI analysis via agent.action.prompt
 * to assess materiality, then pre-translates changed fields for ALL stale locales
 * via agent.action.translate with field-scoped targets.
 *
 * Results are cached on the metadata doc as `staleAnalysis` so the inspector UI
 * has instant results when an editor opens a stale document.
 */

import type {
  PreTranslatedSuggestion,
  StaleAnalysisResult,
  StaleAnalysisSuggestion,
  WorkflowStateEntry,
} from '@starter/l10n/core/types'

import {buildFieldSummary, type TextExtracts} from '@starter/l10n/core/buildFieldSummary'
import {computeFieldChanges, type FieldChange} from '@starter/l10n/core/computeFieldChanges'
import {extractBlockText} from '@starter/l10n/core/extractBlockText'
import {sanitizeTranslationValue} from '@starter/l10n/core/sanitizeTranslationValue'
import {isAnalysisFresh, writeAnalysisCache} from '@starter/l10n/core/staleAnalysisCache'
import {ANALYSIS_PROMPT_INSTRUCTION} from '@starter/l10n/core/staleAnalysisPrompt'
import {
  assembleStyleGuide,
  extractProtectedPhrases,
  filterGlossaryByContent,
  type Glossary,
  type StyleGuide,
} from '@starter/l10n/promptAssembly'
import {GLOSSARIES_QUERY, STYLE_GUIDE_FOR_LOCALE_QUERY} from '@starter/l10n/queries'
import type {METADATA_QUERY_RESULT, TranslationMetadata} from '@starter/sanity-types'
import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'
import {diffWords} from 'diff'
import {defineQuery} from 'groq'
import {type DocumentId, getPublishedId} from '@sanity/id-utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_LANGUAGE = 'en-US'

/** Max locales to pre-translate in parallel per batch. Conservative for rate limits. */
const LOCALE_BATCH_SIZE = 3

// ---------------------------------------------------------------------------
// GROQ queries (function-specific)
// ---------------------------------------------------------------------------

/** Fetch full metadata doc for analysis pipeline. */
const METADATA_QUERY = defineQuery(`*[_id == $metadataId][0]{
  _id,
  translations,
  workflowStates,
  staleAnalysis
}`)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Event data for translation.metadata mutations. */
type AnalyzeStaleEventData = Pick<TranslationMetadata, '_id' | '_rev' | '_type'>

/** Metadata doc shape from GROQ, narrowed to non-null. */
type MetadataDoc = NonNullable<METADATA_QUERY_RESULT>

// ---------------------------------------------------------------------------
// Helpers (function-specific)
// ---------------------------------------------------------------------------

/**
 * Build textExtracts map for PT fields from raw document values.
 * Uses extractBlockText since the History API returns raw JSON.
 */
function buildTextExtracts(changes: FieldChange[]): TextExtracts {
  const extracts: TextExtracts = {}
  for (const c of changes) {
    if (c.fieldType === 'portableText' && c.changed) {
      extracts[c.fieldName] = {
        newText: extractPTText(c.newValue),
        oldText: extractPTText(c.oldValue),
      }
    }
  }
  return extracts
}

/**
 * Extract plain text from a PT field value for the field summary.
 * Uses extractBlockText from l10n/core — flattens children[].text per block.
 */
function extractPTText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(extractBlockText).filter(Boolean).join(' ')
}

/** Filter workflowStates to valid entries. */
function filterWorkflowStates(raw: MetadataDoc['workflowStates']): WorkflowStateEntry[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.filter((e): e is WorkflowStateEntry => !!e.status)
}

/**
 * Parse and validate the AI analysis response.
 * Strips markdown fences if present, filters invalid field names.
 */
function parseAnalysisResponse(raw: string, validFieldNames: Set<string>): StaleAnalysisResult {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
  const parsed = JSON.parse(cleaned)

  // Validate required fields
  if (!parsed.materiality || !parsed.suggestions || !parsed.explanation) {
    throw new Error('AI response missing required fields: materiality, explanation, or suggestions')
  }

  // Validate materiality value
  if (!['cosmetic', 'material', 'minor'].includes(parsed.materiality)) {
    throw new Error(`Invalid materiality value: ${parsed.materiality}`)
  }

  // Filter out hallucinated field names — only keep suggestions for real fields
  const validSuggestions: StaleAnalysisSuggestion[] = parsed.suggestions
    .filter((s: {fieldName?: string}) => s.fieldName && validFieldNames.has(s.fieldName))
    .map(
      (s: {
        changeSummary?: string
        explanation: string
        fieldName: string
        impactTags?: string[]
        reasonCode?: string
        recommendation: string
      }) => ({
        explanation: s.explanation || '',
        fieldName: s.fieldName,
        recommendation: s.recommendation === 'retranslate' ? 'retranslate' : ('dismiss' as const),
        ...(s.changeSummary && {changeSummary: s.changeSummary}),
        ...(s.reasonCode && {reasonCode: s.reasonCode}),
        ...(s.impactTags?.length && {impactTags: s.impactTags}),
      }),
    )

  const droppedCount = parsed.suggestions.length - validSuggestions.length
  if (droppedCount > 0) {
    console.warn(`[AnalyzeStale] Dropped ${droppedCount} suggestions with hallucinated field names`)
  }

  return {
    droppedSuggestionCount: droppedCount > 0 ? droppedCount : undefined,
    explanation: parsed.explanation,
    materiality: parsed.materiality,
    suggestions: validSuggestions,
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler = documentEventHandler<AnalyzeStaleEventData>(async ({context, event}) => {
  const metadataId = event.data._id

  console.log(`[AnalyzeStale] Triggered on metadata doc: ${metadataId}`)

  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-16',
    useCdn: false,
  })

  const agentClient = createClient({
    ...context.clientOptions,
    apiVersion: 'vX',
    useCdn: false,
  })

  // Step 1: Read full metadata doc
  const metadata = await client.fetch<MetadataDoc | null>(METADATA_QUERY, {metadataId})

  if (!metadata) {
    console.log(`[AnalyzeStale] Metadata doc not found: ${metadataId}`)
    return
  }

  // Normalize workflowStates
  const workflowStates = filterWorkflowStates(metadata.workflowStates)
  const staleEntries = workflowStates.filter((ws) => ws.status === 'stale')

  if (staleEntries.length === 0) {
    console.log(`[AnalyzeStale] No stale entries on ${metadataId} — skipping`)
    return
  }

  // Get the staleSourceRev from the first stale entry (all stale entries share the same rev)
  const staleSourceRev = staleEntries[0]!.staleSourceRev
  if (!staleSourceRev) {
    console.log(`[AnalyzeStale] No staleSourceRev on stale entries — skipping`)
    return
  }

  // Step 2: Freshness guard — skip if a valid analysis already exists for this rev.
  const existingAnalysis = metadata.staleAnalysis as Parameters<typeof isAnalysisFresh>[0]
  if (existingAnalysis) {
    const cacheAge = Date.now() - new Date(existingAnalysis.analyzedAt).getTime()
    console.log(
      `[AnalyzeStale] Existing cache: sourceRevision=${existingAnalysis.sourceRevision}, age=${Math.round(cacheAge / 1000)}s, staleSourceRev=${staleSourceRev}, revMatch=${existingAnalysis.sourceRevision === staleSourceRev}`,
    )
  } else {
    console.log(`[AnalyzeStale] No existing analysis cache`)
  }
  if (isAnalysisFresh(existingAnalysis, staleSourceRev)) {
    console.log(`[AnalyzeStale] Fresh analysis exists for rev ${staleSourceRev} — skipping`)
    return
  }

  // Step 3: Find the base-language source document
  const baseTranslation = metadata.translations?.find((t) => t.language === BASE_LANGUAGE)
  const sourceDocRef = baseTranslation?.value?._ref
  if (!sourceDocRef) {
    console.log(`[AnalyzeStale] No base-language (${BASE_LANGUAGE}) translation ref found`)
    return
  }
  const publishedSourceId = getPublishedId(sourceDocRef as DocumentId)

  // Get sourceRevision from a stale entry (the rev at translation time — our "before" snapshot)
  const sourceRevision = staleEntries.find((e) => e.sourceRevision)?.sourceRevision
  if (!sourceRevision) {
    console.log(`[AnalyzeStale] No sourceRevision on stale entries — cannot compute diff`)
    return
  }

  console.log(
    `[AnalyzeStale] Analyzing: source=${publishedSourceId}, oldRev=${sourceRevision}, staleRev=${staleSourceRev}, staleLocales=${staleEntries.map((e) => e.language).join(',')}`,
  )

  // Step 4: Fetch historical + current source documents
  const dataset = context.clientOptions.dataset ?? 'production'
  let historicalDoc: null | Record<string, unknown> = null
  let currentDoc: null | Record<string, unknown> = null

  try {
    const [histResponse, current] = await Promise.all([
      client.request<{documents?: Array<Record<string, unknown>>}>({
        url: `/data/history/${dataset}/documents/${publishedSourceId}?revision=${sourceRevision}`,
      }),
      client.fetch<null | Record<string, unknown>>(
        `*[_id == $id || _id == $draftId] | order(_id asc)[0]`,
        {draftId: `drafts.${publishedSourceId}`, id: publishedSourceId},
      ),
    ])
    historicalDoc = histResponse?.documents?.[0] ?? null
    currentDoc = current
  } catch (err) {
    console.error(`[AnalyzeStale] Failed to fetch source documents:`, err)
    return
  }

  if (!historicalDoc || !currentDoc) {
    console.log(
      `[AnalyzeStale] Could not fetch both document versions (historical=${!!historicalDoc}, current=${!!currentDoc})`,
    )
    return
  }

  // Diagnostic: log document revisions and field keys to verify History API returned the right doc
  console.log(
    `[AnalyzeStale] Historical doc _rev=${historicalDoc._rev}, fields=[${Object.keys(historicalDoc)
      .filter((k) => !k.startsWith('_'))
      .join(',')}]`,
  )
  console.log(
    `[AnalyzeStale] Current doc _rev=${currentDoc._rev}, _id=${currentDoc._id}, fields=[${Object.keys(
      currentDoc,
    )
      .filter((k) => !k.startsWith('_'))
      .join(',')}]`,
  )

  // Diagnostic: check if History API returned the revision we asked for
  if (historicalDoc._rev !== sourceRevision) {
    console.warn(
      `[AnalyzeStale] History API returned _rev=${historicalDoc._rev} but we requested revision=${sourceRevision}. Possible draft _rev mismatch — History API only tracks published revisions.`,
    )
  }

  // Step 5: Compute field-level diff
  const fieldChanges = computeFieldChanges(historicalDoc, currentDoc)
  const changedFields = fieldChanges.filter((f) => f.changed)

  // Diagnostic: log ALL field changes (not just changed ones) to see what computeFieldChanges detected
  console.log(
    `[AnalyzeStale] Field changes (${fieldChanges.length} total, ${changedFields.length} changed):`,
  )
  for (const fc of fieldChanges) {
    const detail =
      fc.fieldType === 'portableText'
        ? `, oldBlocks=${Array.isArray(fc.oldValue) ? (fc.oldValue as unknown[]).length : 'N/A'}, newBlocks=${Array.isArray(fc.newValue) ? (fc.newValue as unknown[]).length : 'N/A'}`
        : fc.fieldType === 'string'
          ? `, old="${String(fc.oldValue ?? '').slice(0, 80)}", new="${String(fc.newValue ?? '').slice(0, 80)}"`
          : ''
    console.log(
      `  ${fc.changed ? 'CHANGED' : '.'} ${fc.fieldName}: type=${fc.fieldType}, magnitude=${fc.magnitude}${detail}`,
    )
  }

  if (changedFields.length === 0) {
    console.log(`[AnalyzeStale] No field changes detected — writing empty analysis`)
    await writeAnalysisCache(
      client,
      metadataId,
      staleSourceRev,
      {
        explanation:
          'No meaningful changes detected between document versions. The content appears identical.',
        materiality: 'cosmetic',
        suggestions: [],
      },
      [],
    )
    return
  }

  const textExtracts = buildTextExtracts(fieldChanges)

  // Diagnostic: log text extracts for PT fields
  for (const [fieldName, extract] of Object.entries(textExtracts)) {
    console.log(
      `[AnalyzeStale] Text extract for "${fieldName}": oldText=${(extract.oldText ?? '').length} chars, newText=${(extract.newText ?? '').length} chars`,
    )
    if ((extract.oldText ?? '').length < 200) {
      console.log(`  Old: "${extract.oldText}"`)
    }
    if ((extract.newText ?? '').length < 200) {
      console.log(`  New: "${extract.newText}"`)
    }
  }

  const fieldSummary = buildFieldSummary(fieldChanges, textExtracts, diffWords)
  const validFieldNames = new Set(changedFields.map((f) => f.fieldName))

  // Diagnostic: log the full field summary that the AI will receive
  console.log(
    `[AnalyzeStale] ${changedFields.length} fields changed: ${[...validFieldNames].join(', ')}`,
  )
  console.log(
    `[AnalyzeStale] Field summary for AI prompt (${fieldSummary.length} chars):\n${fieldSummary}`,
  )

  // Step 6: AI analysis via agent.action.prompt
  let analysisResult: StaleAnalysisResult

  try {
    const promptInstruction = ANALYSIS_PROMPT_INSTRUCTION.replace('$fieldSummary', fieldSummary)

    console.log(`[AnalyzeStale] Sending prompt to AI (${promptInstruction.length} chars)`)

    const response = await agentClient.agent.action.prompt({
      instruction: promptInstruction,
    })

    // Diagnostic: log raw AI response before parsing
    console.log(`[AnalyzeStale] Raw AI response (${response.length} chars):\n${response}`)

    analysisResult = parseAnalysisResponse(response, validFieldNames)

    console.log(
      `[AnalyzeStale] AI analysis: materiality=${analysisResult.materiality}, suggestions=${analysisResult.suggestions.length}${analysisResult.droppedSuggestionCount ? `, dropped=${analysisResult.droppedSuggestionCount}` : ''}`,
    )
  } catch (err) {
    console.error(`[AnalyzeStale] AI analysis failed:`, err)
    // Write a minimal result so the client knows analysis was attempted but failed
    return
  }

  // Step 7a: Write analysis cache immediately (before pre-translation)
  try {
    await writeAnalysisCache(client, metadataId, staleSourceRev, analysisResult, [])
    console.log(
      `[AnalyzeStale] Phase 1: analysis cached on ${metadataId} (no pre-translations yet)`,
    )
  } catch (err) {
    console.error(`[AnalyzeStale] Failed to write phase 1 analysis cache:`, err)
    // Continue — pre-translation may still succeed and write the full cache
  }

  // Step 7b: Pre-translate changed fields for all stale locales
  const fieldsToTranslate = analysisResult.suggestions
    .filter((s) => s.recommendation === 'retranslate')
    .map((s) => s.fieldName)

  const preTranslations: PreTranslatedSuggestion[] = []

  if (fieldsToTranslate.length > 0) {
    const staleLocaleIds = staleEntries.map((e) => e.language)

    console.log(
      `[AnalyzeStale] Pre-translating ${fieldsToTranslate.length} fields x ${staleLocaleIds.length} locales`,
    )

    // Fetch glossary data once (shared across all locales)
    let glossaries: Glossary[] = []
    try {
      glossaries = await client.fetch<Glossary[]>(GLOSSARIES_QUERY)
    } catch {
      console.warn(`[AnalyzeStale] Failed to fetch glossaries — continuing without`)
    }

    const relevantGlossaries = filterGlossaryByContent(glossaries, currentDoc)
    const protectedPhrases = extractProtectedPhrases(relevantGlossaries)

    // Process locales in batches to respect rate limits
    for (let i = 0; i < staleLocaleIds.length; i += LOCALE_BATCH_SIZE) {
      const batch = staleLocaleIds.slice(i, i + LOCALE_BATCH_SIZE)

      const batchResults = await Promise.all(
        batch.map(async (localeId) => {
          const localeResults: PreTranslatedSuggestion[] = []

          // Fetch style guide for this locale
          let styleGuide = ''
          try {
            const styleGuideDoc = await client.fetch<null | StyleGuide>(
              STYLE_GUIDE_FOR_LOCALE_QUERY,
              {
                localeCode: localeId,
              },
            )
            styleGuide = assembleStyleGuide(
              relevantGlossaries,
              localeId,
              styleGuideDoc ?? undefined,
            )
          } catch {
            // Continue without style guide
          }

          // Translate each field individually
          for (const fieldName of fieldsToTranslate) {
            try {
              const result = await agentClient.agent.action.translate({
                documentId: publishedSourceId,
                fromLanguage: {id: BASE_LANGUAGE, title: BASE_LANGUAGE},
                languageFieldPath: 'language',
                noWrite: true,
                schemaId: '_.schemas.default',
                target: {include: [fieldName]},
                targetDocument: {operation: 'create'},
                toLanguage: {id: localeId, title: localeId},
                ...(styleGuide && {styleGuide}),
                ...(protectedPhrases.length > 0 && {protectedPhrases}),
              })

              if (result && result[fieldName] !== undefined) {
                localeResults.push({
                  fieldName,
                  localeId,
                  suggestedValue: sanitizeTranslationValue(result[fieldName]),
                })
              }
            } catch (err) {
              console.error(
                `[AnalyzeStale] Failed to pre-translate ${fieldName} for ${localeId}:`,
                err,
              )
              // Continue — partial results are better than none
            }
          }

          return localeResults
        }),
      )

      preTranslations.push(...batchResults.flat())
    }

    console.log(
      `[AnalyzeStale] Pre-translated ${preTranslations.length} field x locale combinations`,
    )
  }

  // Step 8: Write cache with pre-translations (phase 2 — overwrites phase 1)
  if (preTranslations.length > 0) {
    try {
      await writeAnalysisCache(client, metadataId, staleSourceRev, analysisResult, preTranslations)
      console.log(
        `[AnalyzeStale] Phase 2: analysis + ${preTranslations.length} pre-translations cached on ${metadataId}`,
      )
    } catch (err) {
      console.error(`[AnalyzeStale] Failed to write phase 2 cache:`, err)
      // Phase 1 cache is still intact — user gets analysis without pre-translations
    }
  } else {
    console.log(`[AnalyzeStale] No pre-translations needed — phase 1 cache is final`)
  }
})
