/**
 * Shared translation hook for all Studio surfaces (field actions, document actions, inspector, dashboard).
 *
 * Encapsulates the two-step translate pattern:
 * 1. Fetch glossary + style guide context for the target locale
 * 2. Call the Agent Actions Translate API with merged context
 *
 * Each surface handles its own UI/state concerns — this hook owns only
 * the translate call and context assembly.
 */

import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient} from 'sanity'
import type {TranslateDocument} from '@sanity/client'

import {useTranslationContext} from './translations/useTranslationContext'

/** API version required for client.agent.action.translate(). */
const AGENT_API_VERSION = 'vX'

/** Distributes Omit across union members, preserving variant-specific fields like `noWrite`. */
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

/**
 * Translate params minus the context fields that are auto-populated
 * from glossary and style guide data.
 */
export type TranslateParams = DistributiveOmit<TranslateDocument, 'styleGuide' | 'protectedPhrases'>

export type TranslateFn = (
  params: TranslateParams,
  sourceDocument?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>

// ---------------------------------------------------------------------------
// Batch translate types (fieldLanguageMap)
// ---------------------------------------------------------------------------

export interface FieldLanguageMapEntry {
  inputLanguageId: string
  inputPath: string
  outputs: Array<{id: string; outputPath: string}>
}

/**
 * Params for a batch field translation via `fieldLanguageMap`.
 * Omits `target` (defaults to document root) and `fromLanguage`
 * (each entry carries its own `inputLanguageId`).
 */
export interface TranslateBatchParams {
  schemaId: string
  documentId: string
  toLanguage: {id: string; title?: string}
  noWrite: true
  fieldLanguageMap: FieldLanguageMapEntry[]
}

export type TranslateBatchFn = (
  params: TranslateBatchParams,
  sourceDocument?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>

/**
 * Hook providing a context-aware `translate()` function.
 *
 * Internally manages the agent client (vX) and glossary/style guide context.
 * Callers only need to supply the translate params and optional source document.
 *
 * @example
 * ```ts
 * const {translate} = useTranslate()
 * const result = await translate<{bio: string}>({...}, sourceDoc)
 * //    ^? {bio: string} | null
 * ```
 */
export function useTranslate(): {translate: TranslateFn; translateBatch: TranslateBatchFn} {
  const agentClient = useClient({...DEFAULT_STUDIO_CLIENT_OPTIONS, apiVersion: AGENT_API_VERSION})
  const {getContextForLocale} = useTranslationContext()

  const translate: TranslateFn = async (params, sourceDocument) => {
    const context = await getContextForLocale(params.toLanguage.id, sourceDocument)

    return agentClient.agent.action.translate({
      ...params,
      conditionalPaths: {defaultHidden: false},
      ...(context.styleGuide && {styleGuide: context.styleGuide}),
      ...(context.protectedPhrases.length > 0 && {
        protectedPhrases: context.protectedPhrases,
      }),
    } as TranslateDocument)
  }

  /**
   * Batch translate multiple fields in a single API call via `fieldLanguageMap`.
   *
   * Uses the raw HTTP endpoint because `@sanity/client` types don't expose
   * `fieldLanguageMap` on `TranslateDocument` yet. The backend accepts it as
   * a sibling parameter alongside `styleGuide` and `protectedPhrases`.
   *
   * 1 API call = 1 AI credit regardless of the number of fields.
   */
  const translateBatch: TranslateBatchFn = async (params, sourceDocument) => {
    const context = await getContextForLocale(params.toLanguage.id, sourceDocument)
    const {dataset} = agentClient.config()

    if (!dataset) {
      throw new Error('Sanity client is not configured with a dataset')
    }

    return agentClient.request({
      method: 'POST',
      uri: `/agent/action/translate/${dataset}`,
      body: {
        ...params,
        conditionalPaths: {defaultHidden: false},
        ...(context.styleGuide && {styleGuide: context.styleGuide}),
        ...(context.protectedPhrases.length > 0 && {
          protectedPhrases: context.protectedPhrases,
        }),
      },
      tag: 'translate.batch',
    })
  }

  return {translate, translateBatch}
}
