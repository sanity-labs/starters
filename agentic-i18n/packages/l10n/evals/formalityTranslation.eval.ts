import {describe, it, expect} from 'vitest'
import {techGlossary, styleGuideForLocale, sourceTexts} from './fixtures'
import {runBaselineComparison} from './model-scoring'
import type {ModelEvalCase} from './model-eval-types'

const cases: ModelEvalCase[] = [
  {
    id: 'model-formality-de-sie',
    description:
      'German translation uses formal "Sie", approved terms, and preserves product names',
    sourceText: sourceTexts.productDescription,
    sourceLocale: 'en-US',
    targetLocale: 'de-DE',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('de-DE'),
    fieldPath: 'excerpt',
    expectations: {
      shouldContain: ['Sie', 'Datensatz', 'Portable Text', 'Perspectives', 'Releases'],
      description: 'Prompt specifies formal address, approved terms, and DNT product names',
    },
    translationExpectations: {
      shouldContain: ['Sie', 'Datensatz', 'Portable Text', 'Perspectives', 'Releases'],
      shouldNotContain: [
        'du ',
        'dein ',
        'dir ',
        'Tragbarer Text', // literal German for Portable Text (would never appear naturally)
        // Note: "Veröffentlichungen" and "Perspektiven" are omitted because they're common
        // German words that appear naturally in translation (e.g., "Koordinieren Sie
        // Veröffentlichungen" for "Coordinate launches"). The shouldContain checks for
        // "Releases" and "Perspectives" already verify the product names were preserved.
      ],
      description:
        'Uses formal "Sie", approved "Datensatz" for dataset, "Feld" for field, ' +
        'and preserves product names (Portable Text, Perspectives, Releases) in English',
    },
    qualityCriteria:
      'Must use formal "Sie" address throughout (avoid informal "du/dein/dir"). ' +
      'Must use "Datensatz" for dataset, "Feld" for field, "Dokumentaktion" for document action. ' +
      'Must preserve Sanity product names exactly: "Portable Text" (not "Tragbarer Text"), ' +
      '"Perspectives" (not "Perspektiven"), "Releases" (not "Veröffentlichungen"), ' +
      '"Content Lake", "GROQ", "Studio". ' +
      'Tone should be professional and precise per style guide.',
    baselineRisks: [
      'Model defaults to informal "du" for marketing copy without style guide',
      'Model translates "Portable Text" to "Tragbarer Text" (looks like a generic phrase)',
      'Model translates "Releases" to "Veröffentlichungen" (common German word)',
      'Model translates "Perspectives" to "Perspektiven"',
      'Model translates "dataset" inconsistently without glossary',
    ],
  },
]

describe('Model eval: Formality and register (German)', () => {
  it.each(cases)(
    '$id: $description',
    async (evalCase) => {
      const comparison = await runBaselineComparison(evalCase)

      console.log(`\n--- ${evalCase.id} ---`)
      console.log(`With context:    "${comparison.withContext.translation.fieldText}"`)
      console.log(`Without context: "${comparison.withoutContext.translation.fieldText}"`)
      console.log(
        `Deterministic (with): ${JSON.stringify(comparison.withContext.score.deterministic)}`,
      )
      console.log(
        `Judge (with):    ${comparison.withContext.score.judge.overall}/5 — ${comparison.withContext.score.judge.reasoning}`,
      )
      console.log(
        `Judge (without): ${comparison.withoutContext.score.judge.overall}/5 — ${comparison.withoutContext.score.judge.reasoning}`,
      )
      console.log(
        `Quality delta:   ${comparison.qualityDelta > 0 ? '+' : ''}${comparison.qualityDelta}`,
      )

      expect(comparison.withContext.score.pass).toBe(true)
      expect(comparison.withContext.score.judge.formalityMatch).toBeGreaterThanOrEqual(4)
      expect(comparison.qualityDelta).toBeGreaterThanOrEqual(0)
    },
    120_000,
  )
})
