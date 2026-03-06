/**
 * Hook that fetches glossaries and style guides via useQuery, then provides
 * a function to assemble translation parameters (styleGuide + protectedPhrases)
 * for any target locale. Bridges @starter/l10n prompt assembly into the SDK app.
 *
 * Ensures dashboard translations respect brand terminology,
 * do-not-translate terms, formality levels, and tone guidelines — matching
 * the quality of the Studio plugin's translation output.
 */

import {GLOSSARIES_QUERY} from '@starter/l10n'
import {
  assembleStyleGuide,
  extractProtectedPhrases,
  filterGlossaryByContent,
  type Glossary,
  type StyleGuide,
} from '@starter/l10n/promptAssembly'
import {useQuery} from '@sanity/sdk-react'
import {defineQuery} from 'groq'
import {useCallback, useMemo} from 'react'

/**
 * Fetches all style guides in one query (batch instead of per-locale).
 */
const ALL_STYLE_GUIDES_QUERY = defineQuery(`*[_type == "l10n.styleGuide"]{
  title,
  "locale": locale->{
    "code": code,
    title
  },
  formality,
  tone,
  additionalInstructions
}`)

export interface TranslationParams {
  protectedPhrases: string[]
  styleGuide: string
}

export function useTranslationParams() {
  const {data: glossaries} = useQuery<Glossary[]>({
    query: GLOSSARIES_QUERY,
  })

  const {data: allStyleGuides} = useQuery<StyleGuide[]>({
    query: ALL_STYLE_GUIDES_QUERY,
  })

  const styleGuideMap = useMemo(() => {
    const map = new Map<string, StyleGuide>()
    if (allStyleGuides) {
      for (const sg of allStyleGuides) {
        if (sg.locale?.code) {
          map.set(sg.locale.code, sg)
        }
      }
    }
    return map
  }, [allStyleGuides])

  const safeGlossaries = useMemo(() => glossaries ?? [], [glossaries])

  const buildParams = useCallback(
    (targetLocaleTag: string, sourceDocument?: Record<string, unknown>): TranslationParams => {
      const relevantGlossaries = sourceDocument
        ? filterGlossaryByContent(safeGlossaries, sourceDocument)
        : safeGlossaries

      const protectedPhrases = extractProtectedPhrases(relevantGlossaries)
      const styleGuideDoc = styleGuideMap.get(targetLocaleTag)
      const styleGuide = assembleStyleGuide(relevantGlossaries, targetLocaleTag, styleGuideDoc)

      return {protectedPhrases, styleGuide}
    },
    [safeGlossaries, styleGuideMap],
  )

  return {buildParams, glossaries: safeGlossaries}
}
