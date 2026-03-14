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

import {useCallback} from 'react'
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

/**
 * Generic translate function — callers narrow the return document shape via `T`.
 *
 * @typeParam T - The expected shape of the translated document (defaults to `Record<string, unknown>`).
 */
export interface TranslateFn {
  <T extends Record<string, unknown> = Record<string, unknown>>(
    params: TranslateParams,
    sourceDocument?: Record<string, unknown>,
  ): Promise<T | null>
}

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
export function useTranslate(): {translate: TranslateFn} {
  const agentClient = useClient({...DEFAULT_STUDIO_CLIENT_OPTIONS, apiVersion: AGENT_API_VERSION})
  const {getContextForLocale} = useTranslationContext()

  const translate: TranslateFn = useCallback(
    async (params: TranslateParams, sourceDocument?: Record<string, unknown>) => {
      const context = await getContextForLocale(params.toLanguage.id, sourceDocument)

      return agentClient.agent.action.translate({
        ...params,
        ...(context.styleGuide && {styleGuide: context.styleGuide}),
        ...(context.protectedPhrases.length > 0 && {
          protectedPhrases: context.protectedPhrases,
        }),
      } as TranslateDocument)
    },
    [agentClient, getContextForLocale],
  ) as TranslateFn

  return {translate}
}
