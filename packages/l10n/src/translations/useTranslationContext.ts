/**
 * Hook that provides glossary and style guide data for translation context.
 *
 * Glossaries are fetched via `documentStore.listenQuery()` for realtime
 * updates (e.g., when an editor adds a new glossary term).
 * Style guide fetch is kept as a one-shot callback (correct for action-time).
 */

import {useCallback, useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, useDocumentStore, usePerspective} from 'sanity'
import {useObservable} from 'react-rx'
import type {Glossary, StyleGuide} from '../promptAssembly'
import {
  filterGlossaryByContent,
  assembleStyleGuide,
  extractProtectedPhrases,
} from '../promptAssembly'
import {GLOSSARIES_QUERY, STYLE_GUIDE_FOR_LOCALE_QUERY} from '../queries'

export interface TranslationContext {
  styleGuide: string
  protectedPhrases: string[]
}

export function useTranslationContext() {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const glossaries$ = useMemo(
    () =>
      documentStore.listenQuery(
        GLOSSARIES_QUERY,
        {},
        {
          ...DEFAULT_STUDIO_CLIENT_OPTIONS,
          perspective: perspectiveStack,
        },
      ),
    [documentStore, perspectiveStack],
  )

  const glossaries = useObservable(glossaries$) as Glossary[] | undefined

  const getContextForLocale = useCallback(
    async (
      targetLocaleTag: string,
      sourceDocument?: Record<string, unknown>,
    ): Promise<TranslationContext> => {
      const styleGuideDoc = await client
        .fetch<StyleGuide | null>(
          STYLE_GUIDE_FOR_LOCALE_QUERY,
          {localeCode: targetLocaleTag},
          {perspective: perspectiveStack},
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
