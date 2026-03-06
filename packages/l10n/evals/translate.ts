import {getValueAtPath, stringToPath} from 'sanity'
import {buildTranslateParams, type Glossary, type StyleGuide} from '../src/promptAssembly'
import type {TranslationResult} from './model-eval-types'
import {getClient} from './client'

const DOCUMENT_ID = 'product-eval-source'
const SCHEMA_ID = '_.schemas.default'

/**
 * Translate the seeded eval product using the Agent Action API.
 * With-context: passes styleGuide + protectedPhrases from the l10n plugin.
 * Without-context: bare translate (just languages).
 */
export async function translateDocument(options: {
  targetLocale: {code: string; title: string}
  sourceLocale?: {code: string; title: string}
  glossaries?: Glossary[]
  styleGuide?: StyleGuide
  fieldPath: string
}): Promise<TranslationResult> {
  const {targetLocale, sourceLocale, glossaries, styleGuide, fieldPath} = options
  const client = getClient()
  const hasContext = glossaries && glossaries.length > 0

  const start = performance.now()

  // Can't spread buildTranslateParams() — @sanity/client's translate() param
  // is a union type (sync vs async) that loses narrowing through spreads.
  let response: Record<string, unknown>

  if (hasContext) {
    const params = buildTranslateParams({
      schemaId: SCHEMA_ID,
      documentId: DOCUMENT_ID,
      glossaries: glossaries!,
      targetLocale,
      sourceLocale,
      styleGuide,
    })

    response = await client.agent.action.translate({
      schemaId: params.schemaId,
      documentId: params.documentId,
      noWrite: true,
      fromLanguage: params.fromLanguage,
      toLanguage: params.toLanguage,
      styleGuide: params.styleGuide,
      protectedPhrases: params.protectedPhrases,
      targetDocument: params.targetDocument!,
    })
  } else {
    response = await client.agent.action.translate({
      schemaId: SCHEMA_ID,
      documentId: DOCUMENT_ID,
      noWrite: true,
      toLanguage: {id: targetLocale.code, title: targetLocale.title},
      ...(sourceLocale && {fromLanguage: {id: sourceLocale.code, title: sourceLocale.title}}),
      targetDocument: {operation: 'create'},
    })
  }

  const durationMs = Math.round(performance.now() - start)

  return {
    document: response,
    fieldText: String(getValueAtPath(response, stringToPath(fieldPath)) ?? ''),
    durationMs,
  }
}
