import {describe, it, expect} from 'vitest'
import {techGlossary, styleGuideForLocale, sourceTexts} from './fixtures'
import {
  EVAL_CASE_TIMEOUT_MS,
  MIN_DETERMINISTIC_PASS_FRACTION,
  MIN_JUDGE_OVERALL,
  MIN_MEAN_QUALITY_DELTA,
  MIN_PRIMARY_DIMENSION_SCORE,
  formatComparisonReport,
  runSampledComparison,
} from './model-scoring'
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
      shouldContain: [
        'Sie',
        // German declines the approved lemma; plural "Datensätze"/"Datensätzen" is
        // still the approved term for dataset
        ['Datensatz', 'Datensätze', 'Datensätzen'],
        'Portable Text',
        'Perspectives',
        'Releases',
      ],
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
      'An approved term counts as used when it appears declined ("Datensätze", "Dokumentaktionen"); ' +
      'do not penalise inflection. ' +
      'Must preserve Sanity product names exactly: "Portable Text" (not "Tragbarer Text"), ' +
      '"Perspectives" (not "Perspektiven"), "Releases" (not "Veröffentlichungen"), ' +
      '"Content Lake", "GROQ", "Studio". ' +
      'These constraints govern how the product names themselves are rendered; the ordinary ' +
      'German words may legitimately appear as translations of other source words ' +
      '(e.g. "Veröffentlichungen" for "launches"). ' +
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
      const result = await runSampledComparison(evalCase)
      console.log(formatComparisonReport(evalCase, result))

      expect(result.deterministicPassFraction).toBeGreaterThanOrEqual(
        MIN_DETERMINISTIC_PASS_FRACTION,
      )
      expect(result.meanJudge.withContext.formalityMatch).toBeGreaterThanOrEqual(
        MIN_PRIMARY_DIMENSION_SCORE,
      )
      expect(result.meanJudge.withContext.overall).toBeGreaterThanOrEqual(MIN_JUDGE_OVERALL)
      expect(result.meanQualityDelta).toBeGreaterThanOrEqual(MIN_MEAN_QUALITY_DELTA)
    },
    EVAL_CASE_TIMEOUT_MS,
  )
})
