/**
 * Hook that provides glossary and style guide data for translation context.
 *
 * Glossaries are fetched via `documentStore.listenQuery()` for realtime
 * updates (e.g., when an editor adds a new glossary term).
 * Style guide fetch is kept as a one-shot callback (correct for action-time).
 */

import {useCallback} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, usePerspective} from 'sanity'
import type {StyleGuide} from '../promptAssembly'
import {
  filterGlossaryByContent,
  assembleStyleGuide,
  extractProtectedPhrases,
} from '../promptAssembly'
import {STYLE_GUIDE_FOR_LOCALE_QUERY} from '../queries'
import {useGlossaries} from '../L10nProvider'

export interface TranslationContext {
  styleGuide: string
  protectedPhrases: string[]
}

export function useTranslationContext() {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const {perspectiveStack} = usePerspective()

  const glossaries = useGlossaries()

  const getContextForLocale = useCallback(
    async (
      targetLocaleTag: string,
      sourceDocument?: Record<string, unknown>,
    ): Promise<TranslationContext> => {
      const styleGuideDoc = await client
        .fetch<StyleGuide | null>(
          STYLE_GUIDE_FOR_LOCALE_QUERY,
          {localeCode: targetLocaleTag},
          {perspective: perspectiveStack, tag: 'translate.style-guide'},
        )
        .catch(() => null)

      const currentGlossaries = glossaries ?? []
      const relevantGlossaries = sourceDocument
        ? filterGlossaryByContent(currentGlossaries, sourceDocument)
        : currentGlossaries

      const styleGuideStr = assembleStyleGuide(
        relevantGlossaries,
        targetLocaleTag,
        styleGuideDoc ?? undefined,
      )

      const protectedPhrases = extractProtectedPhrases(relevantGlossaries)

      return {styleGuide: styleGuideStr, protectedPhrases}
    },
    [client, glossaries, perspectiveStack],
  )

  return {getContextForLocale, hasGlossaries: (glossaries?.length ?? 0) > 0}
}
