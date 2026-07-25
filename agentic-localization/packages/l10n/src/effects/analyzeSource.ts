/**
 * `analyze-source` — works out what changed in a source document and which
 * locales that change affects.
 *
 * The analysis half of the Function this replaces. The pre-translation fan-out
 * that used to follow it is gone: `spawn` in the `localize-document` definition
 * does that now, one child run per locale.
 *
 * The AI judges materiality. It never picks the locales — those come from the
 * `translation.metadata` join document, in code, so a hallucinated language tag
 * cannot start a translation run.
 */

import type {TransactionLogEvent} from '@sanity/types'
import type {EffectHandler, FieldOp} from '@sanity/workflow-engine'
import type {StaleAnalysisResult, StaleAnalysisSuggestion} from '../core/types'

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {createSafeJsonParser} from '@sanity/util/createSafeJsonParser'
import {extractDocumentId} from '@sanity/workflow-engine'
import {diffWords} from 'diff'

import type {FieldChange} from '../core/computeFieldChanges'
import type {InternationalizedField} from '../core/fieldTier'
import type {TextExtracts} from '../core/buildFieldSummary'
import type {ContentClient, EffectContext} from './effectRuntime'

import {buildFieldSummary} from '../core/buildFieldSummary'
import {computeFieldChanges} from '../core/computeFieldChanges'
import {extractBlockText} from '../core/extractBlockText'
import {coveredLocales, internationalizedFields, sourceProjection} from '../core/fieldTier'
import {getTranslationMetadataId} from '../core/ids'
import {isRecord} from '../core/isRecord'
import {ANALYSIS_PROMPT_INSTRUCTION} from '../core/staleAnalysisPrompt'
import {LOCALE_CODES_QUERY, TRANSLATIONS_FOR_DOCUMENT_QUERY} from '../prompts/queries'
import {SOURCE_LANGUAGE} from '../workflows/effects'
import {
  agentClient,
  contentClientFor,
  datasetOf,
  effectAlreadyDone,
  readSubjectDocument,
  requireGdr,
} from './effectRuntime'

const MATERIALITY = ['cosmetic', 'minor', 'material'] as const

/** A locale with no translation at all needs a run whatever the source edit was. */
const MISSING_REASON = 'missing translation'

type Materiality = (typeof MATERIALITY)[number]

type TranslationRow = {language: null | string; ref: null | string}

export const analyzeSource: EffectHandler = async (params, ctx) => {
  if (await effectAlreadyDone(ctx)) {
    ctx.log('Analysis already recorded for this effect key')
    return
  }

  const subject = requireGdr(params, 'subject')
  const client = contentClientFor(ctx, subject)
  const dataset = datasetOf(subject)
  const subjectId = DocumentId(extractDocumentId(subject))
  const publishedId = getPublishedId(subjectId)

  const currentDoc = await readSubjectDocument(client, ctx, publishedId)
  if (!currentDoc) throw new Error(`Source document ${publishedId} not found`)

  // The field tier keeps every locale inside the subject, so both halves of the
  // analysis change: coverage comes from the arrays rather than a join
  // document, and the diff runs over the source-locale values alone.
  const fields = internationalizedFields(typeOf(currentDoc))

  const analyzedRev = typeof currentDoc._rev === 'string' ? currentDoc._rev : null

  // On a `refresh-from-source` re-entry the run already knows what it looked at
  // last time, and that is the honest diff base. On a first pass there is no
  // such record, so fall back to the revision published before this one.
  const baseRev =
    (await readAnalyzedRev(ctx)) ?? (await previousRevision(client, dataset, publishedId))

  const historicalDoc = baseRev
    ? await documentAtRevision(client, dataset, publishedId, baseRev)
    : null

  const localeCodes = await client.fetch<string[]>(LOCALE_CODES_QUERY, {}, {tag: 'get-locales'})
  const translated = new Set(
    fields.length > 0
      ? coveredLocales(currentDoc, fields)
      : await existingTranslationLocales(client, publishedId),
  )
  const candidates = localeCodes.filter((code) => code !== SOURCE_LANGUAGE)
  const missing = candidates.filter((code) => !translated.has(code))

  const compare = comparableProjection(fields)
  const fieldChanges = historicalDoc
    ? computeFieldChanges(compare(historicalDoc), compare(currentDoc))
    : []
  const changedFields = fieldChanges.filter((change) => change.changed)

  // Nothing to diff — a first publish, or an edit that moved no field. A locale
  // that has never been translated still needs a run; one that has does not.
  if (changedFields.length === 0) {
    const preamble = historicalDoc
      ? 'No meaningful changes detected between document versions'
      : 'No earlier revision to compare against'
    return {
      ops: analysisOps({
        analyzedRev,
        materiality: missing.length ? 'material' : 'cosmetic',
        explanation: missing.length
          ? `${preamble}. ${missing.length} of ${candidates.length} locales have no translation yet.`
          : `${preamble} — nothing to retranslate.`,
        targetLocales: missingRows(missing),
      }),
    }
  }

  const fieldSummary = buildFieldSummary(fieldChanges, buildTextExtracts(fieldChanges), diffWords)
  const response = await agentClient(client, ctx).agent.action.prompt({
    instruction: ANALYSIS_PROMPT_INSTRUCTION.replace('$fieldSummary', fieldSummary),
  })

  const analysis = parseAnalysisResponse(
    response,
    new Set(changedFields.map((change) => change.fieldName)),
  )

  // The AI judges the edit, not the coverage. A cosmetic edit spares the
  // locales that already have a translation — that is the definition's
  // nothing-to-do route — but never an untranslated one, which has nothing to
  // be cosmetic about.
  const reason = localeReason(analysis)
  const targetLocales = candidates.flatMap((locale) => {
    if (!translated.has(locale)) return [{locale, reason: MISSING_REASON}]
    return analysis.materiality === 'cosmetic' ? [] : [{locale, reason}]
  })

  ctx.log(`Analysis: materiality=${analysis.materiality}, locales=${targetLocales.length}`, {
    changedFields: changedFields.length,
    missingLocales: missing.length,
  })

  return {
    ops: analysisOps({
      analyzedRev,
      materiality: analysis.materiality,
      explanation: analysis.explanation,
      targetLocales,
    }),
  }
}

/**
 * What two revisions of the subject are compared as.
 *
 * The document tier diffs the whole document. The field tier cannot: its
 * translations live in the subject, so publishing an approved run would read
 * as a material source edit and start the same run again on the next publish,
 * forever. Reducing each revision to its source-locale values makes a
 * translation-only change diff as no change at all.
 */
function comparableProjection(
  fields: InternationalizedField[],
): (document: Record<string, unknown>) => Record<string, unknown> {
  if (fields.length === 0) return (document) => document
  return (document) => sourceProjection(document, fields, SOURCE_LANGUAGE)
}

/**
 * Parse and validate the AI analysis response. Strips markdown fences, rejects
 * an out-of-list materiality, and drops suggestions naming fields that did not
 * change — the model does invent them.
 */
export function parseAnalysisResponse(
  raw: string,
  validFieldNames: Set<string>,
): StaleAnalysisResult {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
  const parsed: unknown = JSON.parse(cleaned)
  if (!isRecord(parsed)) throw new Error('AI analysis response was not a JSON object')

  const {explanation, materiality, suggestions} = parsed
  if (!isMateriality(materiality)) {
    throw new Error(`Invalid materiality value: ${JSON.stringify(materiality)}`)
  }
  if (typeof explanation !== 'string' || !explanation) {
    throw new Error('AI analysis response is missing an explanation')
  }
  if (!Array.isArray(suggestions)) {
    throw new Error('AI analysis response is missing suggestions')
  }

  const valid: StaleAnalysisSuggestion[] = []
  for (const row of suggestions) {
    if (!isRecord(row)) continue
    const {changeSummary, fieldName} = row
    if (typeof fieldName !== 'string' || !validFieldNames.has(fieldName)) continue
    valid.push({
      fieldName,
      explanation: typeof row.explanation === 'string' ? row.explanation : '',
      recommendation: row.recommendation === 'retranslate' ? 'retranslate' : 'dismiss',
      ...(typeof changeSummary === 'string' && {changeSummary}),
    })
  }

  const dropped = suggestions.length - valid.length
  return {
    explanation,
    materiality,
    suggestions: valid,
    ...(dropped > 0 && {droppedSuggestionCount: dropped}),
  }
}

/**
 * Build the `textExtracts` map for Portable Text fields. The History API hands
 * back raw JSON, so the text has to be flattened here rather than projected
 * with `pt::text()`.
 */
export function buildTextExtracts(changes: FieldChange[]): TextExtracts {
  const extracts: TextExtracts = {}
  for (const change of changes) {
    if (change.fieldType === 'portableText' && change.changed) {
      extracts[change.fieldName] = {
        newText: extractPortableText(change.newValue),
        oldText: extractPortableText(change.oldValue),
      }
    }
  }
  return extracts
}

/** One sentence, from the fields the analysis wants retranslated. */
export function localeReason(analysis: StaleAnalysisResult): string {
  const fields = analysis.suggestions
    .filter((suggestion) => suggestion.recommendation === 'retranslate')
    .map((suggestion) => suggestion.fieldName)

  const subject = fields.length ? fields.join(', ') : 'the source document'
  return `${analysis.materiality} change to ${subject}`
}

function missingRows(locales: string[]): {locale: string; reason: string}[] {
  return locales.map((locale) => ({locale, reason: MISSING_REASON}))
}

function analysisOps(state: {
  analyzedRev: null | string
  materiality: Materiality
  explanation: string
  targetLocales: {locale: string; reason: string}[]
}): FieldOp[] {
  const ops: FieldOp[] = [
    set('materiality', state.materiality),
    set('targetLocales', state.targetLocales),
    set('explanation', state.explanation),
  ]
  if (state.analyzedRev) ops.unshift(set('analyzedRev', state.analyzedRev))
  return ops
}

function set(field: string, value: unknown): FieldOp {
  return {type: 'field.set', target: {scope: 'workflow', field}, value: {type: 'literal', value}}
}

/** The revision this run last analyzed, if it has been through here before. */
async function readAnalyzedRev(ctx: EffectContext): Promise<null | string> {
  const value = await ctx.client.fetch<null | string>(
    `*[_id == $instanceId][0].fields[name == "analyzedRev"][0].value`,
    {instanceId: ctx.instanceId},
    {tag: 'read-analyzed-rev'},
  )
  return typeof value === 'string' && value ? value : null
}

async function existingTranslationLocales(
  client: ContentClient,
  publishedId: string,
): Promise<string[]> {
  const metadata = await client.fetch<null | {translations: null | TranslationRow[]}>(
    TRANSLATIONS_FOR_DOCUMENT_QUERY,
    {metadataId: getTranslationMetadataId(publishedId), publishedId},
    {tag: 'get-translation-metadata'},
  )

  const languages = metadata?.translations?.map((row) => row.language) ?? []
  return languages.filter((language): language is string => typeof language === 'string')
}

async function documentAtRevision(
  client: ContentClient,
  dataset: string,
  documentId: string,
  revision: string,
): Promise<null | Record<string, unknown>> {
  const response = await client.request<{documents?: Record<string, unknown>[]}>({
    url: `/data/history/${dataset}/documents/${documentId}?revision=${revision}`,
    tag: 'get-history',
  })
  return response?.documents?.[0] ?? null
}

/**
 * The revision published before the current one, from the transaction log.
 * `includeIdentifiedDocumentsOnly` keeps drafts of the same document out, so
 * the log is the document's publish history. NDJSON, hence `json: false`.
 */
async function previousRevision(
  client: ContentClient,
  dataset: string,
  documentId: string,
): Promise<null | string> {
  const query = 'excludeContent=true&includeIdentifiedDocumentsOnly=true&reverse=true&limit=2'
  const body = await client.request<unknown>({
    url: `/data/history/${dataset}/transactions/${documentId}?${query}`,
    tag: 'get-transactions',
    json: false,
  })

  const previous = parseNdjson(body)[1]
  if (!isTransactionLogEvent(previous)) return null
  return previous.id
}

/**
 * The Export API can interrupt a line of the log with an error object; the
 * shared parser reports that as the error it is rather than a syntax error.
 */
const parseTransactionLine = createSafeJsonParser<unknown>({
  errorLabel: 'Error reading the transaction log',
})

/** Positional: `previousRevision` reads row 1, so a malformed row is kept, not dropped. */
function parseNdjson(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  const text = typeof body === 'string' ? body : String(body ?? '')
  return text.split('\n').filter(Boolean).map(parseTransactionLine)
}

function isTransactionLogEvent(row: unknown): row is TransactionLogEvent {
  return isRecord(row) && typeof row.id === 'string'
}

function extractPortableText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(extractBlockText).filter(Boolean).join(' ')
}

function isMateriality(value: unknown): value is Materiality {
  return MATERIALITY.some((entry) => entry === value)
}

function typeOf(document: Record<string, unknown>): string {
  return typeof document._type === 'string' ? document._type : ''
}
