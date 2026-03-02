import {describe, it, expect} from 'vitest'
import {assembleStyleGuide} from '../src/promptAssembly'
import {techGlossary, styleGuideForLocale} from './fixtures'
import {scorePrompt} from './scoring'
import type {EvalCase} from './types'

const cases: EvalCase[] = [
  {
    id: 'glossary-approved-fr',
    description: 'Approved term translations appear in French prompt',
    sourceText: 'Create a new dataset and add a document action to automate publishing.',
    sourceLocale: 'en-US',
    targetLocale: 'fr-FR',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('fr-FR'),
    expectations: {
      shouldContain: [
        'jeu de données', // approved translation for dataset
        'action de document', // approved translation for document action
        'noun, masculine', // gender metadata
      ],
      description: 'French prompt must include approved glossary translations with metadata',
    },
    baselineRisks: [
      'LLM may translate "dataset" generically or keep it in English',
      'Gender metadata (masculine/feminine) would be missing',
    ],
  },
  {
    id: 'glossary-approved-de',
    description: 'Approved term translations appear in German prompt',
    sourceText: 'Configure a new field in your dataset schema.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    expectations: {
      shouldContain: [
        'Datensatz', // approved translation for dataset in German
        'Feld', // approved translation for field in German
      ],
      description: 'German prompt must include locale-specific approved translations',
    },
    baselineRisks: ['LLM may translate "dataset" and "field" inconsistently across documents'],
  },
  {
    id: 'glossary-dnt',
    description: 'All Sanity product DNT terms are listed',
    sourceText:
      'Configure your Sanity Studio to use GROQ queries on the Content Lake with Portable Text, Perspectives, Releases, and the Presentation Tool. Use Agent Actions to translate content across the Content Operating System.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
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
      description: 'DNT section must list all Sanity product names that should stay in English',
    },
    baselineRisks: [
      'LLM may translate "Sanity" literally (e.g., "Vernunft" in German)',
      'LLM may translate "Portable Text", "Perspectives", or "Releases" as common English words',
      'LLM may translate "Agent Actions", "Presentation Tool", or "Content Operating System" as generic English phrases',
    ],
  },
  {
    id: 'glossary-forbidden',
    description: 'Forbidden terms are flagged with alternatives',
    sourceText:
      'Visit our webpage and click here to learn more. Sanity is a headless CMS for modern teams.',
    sourceLocale: 'en-US',
    targetLocale: 'fr-FR',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('fr-FR'),
    expectations: {
      shouldContain: [
        'Forbidden Terms',
        '"webpage"',
        '"click here"',
        'Use "page" instead',
        '"CMS"',
        '"headless CMS"',
      ],
      description: 'Forbidden terms must appear with their replacement guidance',
    },
    baselineRisks: [
      'LLM would use "webpage" and "click here" without knowing they are prohibited',
      'LLM would describe Sanity as a "CMS" or "headless CMS" without knowing these terms are forbidden',
    ],
  },
]

describe('Glossary compliance', () => {
  it.each(cases)('$id: $description', (evalCase) => {
    const withContext = assembleStyleGuide(
      evalCase.glossaries,
      evalCase.targetLocale,
      evalCase.styleGuide,
    )
    const withoutContext = assembleStyleGuide([], evalCase.targetLocale)

    // With context: all expectations should pass
    const contextScore = scorePrompt(withContext, evalCase.expectations)
    expect(contextScore.pass).toBe(true)

    // Without context: should be empty (no glossaries)
    expect(withoutContext).toBe('')
  })
})
