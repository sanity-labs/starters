import {describe, it, expect} from 'vitest'
import {assembleStyleGuide} from '../src/promptAssembly'
import {techGlossary, styleGuideForLocale} from './fixtures'
import {scorePrompt} from './scoring'
import type {EvalCase} from './types'

const cases: EvalCase[] = [
  {
    id: 'formality-de-formal',
    description: 'German prompt specifies formal register (Sie)',
    sourceText: 'You can manage your content here.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    expectations: {
      shouldContain: ['Formality: formal', 'Sie'],
      description: 'German prompt must specify formal address (Sie vs du)',
    },
    baselineRisks: [
      'LLM often defaults to informal "du" for tech content in German',
      'Without explicit instruction, formality is inconsistent',
    ],
  },
  {
    id: 'formality-fr-formal',
    description: 'French prompt specifies formal register',
    sourceText: 'You can manage your content here.',
    sourceLocale: 'en-US',
    targetLocale: 'fr-FR',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('fr-FR'),
    expectations: {
      shouldContain: ['Formality: formal', 'Académie française'],
      description: 'French prompt must specify formal register and language authority preference',
    },
    baselineRisks: ['Without formality guidance, LLM may mix formal and informal register'],
  },
  {
    id: 'tone-adjectives',
    description: 'Tone personality adjectives are included in prompt',
    sourceText: 'Build faster with Sanity.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    expectations: {
      shouldContain: ['professional', 'precise', 'approachable'],
      description: 'Brand voice adjectives must appear in the style guide section',
    },
    baselineRisks: ['Without tone guidance, translation may not match brand personality'],
  },
  {
    id: 'audience-context',
    description: 'Audience description is included for locale-appropriate targeting',
    sourceText: 'Get started in minutes.',
    sourceLocale: 'en-US',
    targetLocale: 'ja-JP',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('ja-JP'),
    expectations: {
      shouldContain: ['Developers evaluating Sanity', 'Japan', 'desu/masu'],
      description: 'Japanese prompt must include audience context and politeness guidance',
    },
    baselineRisks: [
      'Without audience context, LLM may use wrong politeness level',
      'Technical vs consumer audience distinction lost',
    ],
  },
  {
    id: 'gender-guidance',
    description: 'Gender-inclusive language guidance is present',
    sourceText: 'The developer can configure their workspace.',
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    expectations: {
      shouldContain: ['Gender guidance:', 'Entwickler:innen'],
      description: 'German prompt must include gender-inclusive language instructions',
    },
    baselineRisks: ['LLM may default to masculine-only forms without guidance'],
  },
]

describe('Formality and tone', () => {
  it.each(cases)('$id: $description', (evalCase) => {
    const withContext = assembleStyleGuide(
      evalCase.glossaries,
      evalCase.targetLocale,
      evalCase.styleGuide,
    )
    const withoutContext = assembleStyleGuide([], evalCase.targetLocale)

    const contextScore = scorePrompt(withContext, evalCase.expectations)
    expect(contextScore.pass).toBe(true)

    // Without context: no glossaries or style guide produces nothing
    expect(withoutContext).toBe('')
  })
})
