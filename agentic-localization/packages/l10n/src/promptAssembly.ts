// --- Document text extraction ---

import {portableTextToMarkdown} from '@portabletext/markdown'
import {toPlainText} from '@portabletext/toolkit'
import type {PortableTextBlock} from '@portabletext/types'
import type {TransformTargetDocument, TranslateDocument} from '@sanity/client'
import type {Language} from '@sanity/document-internationalization'
import type {Get} from '@sanity/codegen'
// Inline type guards — avoids importing the full `sanity` Studio package,
// which would pull in React, jsdom, hls.js, etc. into serverless function bundles.
const isString = (v: unknown): v is string => typeof v === 'string'
const isReference = (v: unknown): v is {_ref: string; _type: 'reference'} =>
  typeof v === 'object' && v !== null && '_ref' in v
const isImage = (v: unknown): v is {_type: 'image'; asset?: {_ref: string}} =>
  typeof v === 'object' && v !== null && (v as {_type?: string})._type === 'image'
const isSlug = (v: unknown): v is {_type: 'slug'; current: string} =>
  typeof v === 'object' && v !== null && (v as {_type?: string})._type === 'slug'
const isPortableTextTextBlock = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  (v as {_type?: string})._type === 'block' &&
  Array.isArray((v as {children?: unknown}).children)

/**
 * Recursively extract all human-readable text from an arbitrary Sanity document.
 * Handles plain strings, Portable Text blocks (via @portabletext/toolkit), nested
 * objects, and arrays — without requiring knowledge of the document's schema.
 */
export function extractDocumentText(value: unknown): string {
  switch (true) {
    case value == null:
    case typeof value !== 'object':
      return isString(value) ? value : ''

    case Array.isArray(value):
      return value.some((item) => isPortableTextTextBlock(item))
        ? toPlainText(value as PortableTextBlock[])
        : value.map(extractDocumentText).filter(Boolean).join(' ')

    case isPortableTextTextBlock(value):
      return toPlainText(value as unknown as PortableTextBlock)

    case isReference(value):
    case isImage(value):
    case isSlug(value):
      return ''

    default: {
      const parts: string[] = []
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (key.startsWith('_')) continue
        const text = extractDocumentText(val)
        if (text) parts.push(text)
      }
      return parts.join(' ')
    }
  }
}

// --- Content-aware glossary filtering ---

/**
 * Filter glossary entries to only those whose terms appear in the source document.
 * Uses extractDocumentText to handle any Sanity document shape, then does
 * case-insensitive substring matching against each glossary term.
 */
export function filterGlossaryByContent(
  glossaries: Glossary[],
  sourceDocument: Record<string, unknown>,
): Glossary[] {
  const text = extractDocumentText(sourceDocument).toLowerCase()
  if (!text) return []

  const result: Glossary[] = []
  const seen = new Set<string>()

  for (const glossary of glossaries) {
    if (!glossary.entries?.length) continue

    const relevantEntries = glossary.entries.filter((entry) => {
      if (!entry.term) return false
      if (seen.has(entry.term)) return false
      seen.add(entry.term)
      if (entry.doNotTranslate || entry.status === 'forbidden') return true
      return text.includes(entry.term.toLowerCase())
    })

    if (relevantEntries.length) {
      result.push({...glossary, entries: relevantEntries})
    }
  }

  return result
}

import type {
  GLOSSARIES_QUERY_RESULT,
  STYLE_GUIDE_FOR_LOCALE_QUERY_RESULT,
} from '@starter/sanity-types'

/** Types derived directly from TypeGen GROQ result types. */

export type GlossaryEntry = Get<GLOSSARIES_QUERY_RESULT, number, 'entries', number>
export type Glossary = GLOSSARIES_QUERY_RESULT[number]
export type StyleGuide = NonNullable<STYLE_GUIDE_FOR_LOCALE_QUERY_RESULT>

// Section builders — exported individually for testability

export function buildGlossarySection(glossaries: Glossary[], targetLocale: string): string {
  const approved: string[] = []
  const dnt: string[] = []
  const forbidden: string[] = []
  const seen = new Set<string>()

  for (const glossary of glossaries) {
    if (!glossary.entries) continue

    for (const entry of glossary.entries) {
      if (!entry.term) continue
      if (seen.has(entry.term)) continue
      seen.add(entry.term)

      if (entry.doNotTranslate) {
        dnt.push(entry.term)
        continue
      }

      switch (entry.status) {
        case 'forbidden': {
          forbidden.push(
            [`"${entry.term}"`, entry.definition && `— ${entry.definition}`]
              .filter(Boolean)
              .join(' '),
          )
          break
        }
        case 'approved': {
          const match = entry.translations?.find((t) => t.locale === targetLocale)
          if (!match) break
          const meta = [entry.partOfSpeech, match.gender].filter(Boolean).join(', ')
          approved.push(
            [
              `- "${entry.term}" → "${match.translation}"`,
              meta && `(${meta})`,
              entry.context && `\n  Context: ${entry.context}`,
            ]
              .filter(Boolean)
              .join(' '),
          )
          break
        }
      }
    }
  }

  const sections = [
    approved.length && `### Approved Terms (use these exact translations):\n${approved.join('\n')}`,
    dnt.length &&
      `### Do Not Translate (keep in source language):\n${dnt.map((t) => `- ${t}`).join('\n')}`,
    forbidden.length &&
      `### Forbidden Terms (never use these in output):\n${forbidden.map((t) => `- ${t}`).join('\n')}`,
  ].filter(Boolean)

  if (!sections.length) return ''
  return `## Terminology\n\n${sections.join('\n\n')}`
}

export function buildStyleGuideSection(styleGuide: StyleGuide): string {
  const localeName = styleGuide.locale?.title || styleGuide.locale?.code || 'Unknown'

  return [
    `## Style Guide (${localeName})`,
    '',
    `Formality: ${styleGuide.formality}`,
    styleGuide.tone?.length && `Tone: ${styleGuide.tone.join(', ')}`,
    styleGuide.additionalInstructions?.length &&
      `\n${portableTextToMarkdown(styleGuide.additionalInstructions)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// --- Protected phrases extraction ---

/**
 * Extract Do Not Translate terms from glossaries for the Translate
 * action's `protectedPhrases` parameter.
 */
export function extractProtectedPhrases(glossaries: Glossary[]): string[] {
  const phrases = new Set<string>()
  for (const glossary of glossaries) {
    if (!glossary.entries) continue
    for (const entry of glossary.entries) {
      if (entry.doNotTranslate && entry.term) phrases.add(entry.term)
    }
  }
  return [...phrases]
}

// --- Style guide size measurement ---

export const STYLE_GUIDE_WARN_THRESHOLD = 12_000

/**
 * Measure the size of an assembled styleGuide string. Callers can use this
 * to decide whether to warn, truncate, or proceed.
 */
export function measureStyleGuide(styleGuide: string): {
  charCount: number
  estimatedTokens: number
  isOverThreshold: boolean
} {
  const charCount = styleGuide.length
  const estimatedTokens = Math.ceil(charCount / 4)
  return {charCount, estimatedTokens, isOverThreshold: charCount > STYLE_GUIDE_WARN_THRESHOLD}
}

// --- Translate action orchestration ---

/**
 * Build the complete parameter object for the Sanity Agent Actions Translate API.
 * Maps the l10n plugin's data model to the API's expected shape.
 */
export function buildTranslateParams(options: {
  schemaId: string
  documentId: string
  glossaries: Glossary[]
  targetLocale: {code: string; title: string}
  sourceLocale?: {code: string; title: string}
  styleGuide?: StyleGuide
  operation?: 'create' | 'edit' | 'createOrReplace' | 'createIfNotExists'
  targetDocumentId?: string
  languageFieldPath?: string
}): TranslateDocument {
  const toLanguage: Language = {
    id: options.targetLocale.code,
    title: options.targetLocale.title,
  }

  const fromLanguage: Language | undefined = options.sourceLocale
    ? {id: options.sourceLocale.code, title: options.sourceLocale.title}
    : undefined

  const styleGuideStr = assembleStyleGuide(
    options.glossaries,
    options.targetLocale.code,
    options.styleGuide,
  )

  const protectedPhrases = extractProtectedPhrases(options.glossaries)

  const operation = options.operation ?? 'create'
  const targetDocument: TransformTargetDocument =
    operation === 'create'
      ? {operation, ...(options.targetDocumentId && {_id: options.targetDocumentId})}
      : {operation, _id: options.targetDocumentId!}

  const params: TranslateDocument = {
    schemaId: options.schemaId,
    documentId: options.documentId,
    toLanguage,
    styleGuide: styleGuideStr,
    protectedPhrases,
    targetDocument,
  }

  if (fromLanguage) params.fromLanguage = fromLanguage
  if (options.languageFieldPath) params.languageFieldPath = options.languageFieldPath

  return params
}

// Main assembler

export function assembleStyleGuide(
  glossaries: Glossary[],
  targetLocale: string,
  styleGuide?: StyleGuide,
): string {
  return [
    glossaries.length && buildGlossarySection(glossaries, targetLocale),
    styleGuide && buildStyleGuideSection(styleGuide),
  ]
    .filter(Boolean)
    .join('\n\n')
}
