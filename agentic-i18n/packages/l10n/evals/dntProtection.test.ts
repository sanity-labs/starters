import {describe, it, expect} from 'vitest'
import {assembleStyleGuide} from '../src/promptAssembly'
import {techGlossary, styleGuideForLocale} from './fixtures'
import {scorePrompt} from './scoring'
import type {EvalCase} from './types'

const cases: EvalCase[] = [
  {
    id: 'dnt-brand-names',
    description: 'All Sanity product names appear in DNT section',
    sourceText: 'Get started with Sanity Studio in minutes.',
    sourceLocale: 'en-US',
    targetLocale: 'ja-JP',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('ja-JP'),
    expectations: {
      shouldContain: [
        'Do Not Translate',
        'Sanity',
        'GROQ',
        'Content Lake',
        'Studio',
        'Portable Text',
        'Perspectives',
        'Releases',
        'Agent Actions',
        'Content Operating System',
        'Presentation Tool',
      ],
      description: 'All Sanity product names must be listed as DNT regardless of target locale',
    },
    baselineRisks: [
      '"Sanity" could be translated literally (正気 in Japanese)',
      '"Portable Text" looks like a generic phrase and could be translated',
      '"Releases" and "Perspectives" are common English words that look translatable',
      '"Agent Actions", "Presentation Tool", and "Content Operating System" look like generic English',
    ],
  },
  {
    id: 'dnt-generic-looking-terms',
    description: 'Product names that look like common English words are protected',
    sourceText: 'Use Perspectives to preview Releases before publishing from the Content Lake.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    expectations: {
      shouldContain: ['Content Lake', 'Perspectives', 'Releases'],
      shouldMatchPattern: [
        /Do Not Translate[\s\S]*Content Lake/,
        /Do Not Translate[\s\S]*Perspectives/,
        /Do Not Translate[\s\S]*Releases/,
      ],
      description:
        'Generic-looking product names must appear in DNT section, not be translated as common words',
    },
    baselineRisks: [
      '"Perspectives" looks like a common word — German might produce "Perspektiven"',
      '"Releases" looks like a common word — German might produce "Veröffentlichungen"',
      '"Content Lake" might be translated literally as "Inhalts-See"',
    ],
  },
]

describe('DNT and constraint protection', () => {
  it.each(cases)('$id: $description', (evalCase) => {
    const withContext = assembleStyleGuide(
      evalCase.glossaries,
      evalCase.targetLocale,
      evalCase.styleGuide,
    )
    const withoutContext = assembleStyleGuide([], evalCase.targetLocale)

    const contextScore = scorePrompt(withContext, evalCase.expectations)
    expect(contextScore.pass).toBe(true)

    // Without context: no glossaries produces nothing
    expect(withoutContext).toBe('')
  })
})
