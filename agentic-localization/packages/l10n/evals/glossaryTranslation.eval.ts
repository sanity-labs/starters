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
    id: 'model-glossary-fr-product-terms',
    description:
      'French translation uses approved glossary terms and preserves Sanity product names',
    sourceText: sourceTexts.productDescription,
    sourceLocale: 'en-US',
    targetLocale: 'fr-FR',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('fr-FR'),
    fieldPath: 'excerpt',
    expectations: {
      shouldContain: [
        'jeu de données',
        'action de document',
        'Portable Text',
        'Perspectives',
        'Releases',
      ],
      description: 'Prompt includes approved French translations and DNT product names',
    },
    translationExpectations: {
      shouldContain: [
        // French pluralises the approved lemma; both forms are the approved term
        ['jeu de données', 'jeux de données'],
        ['action de document', 'actions de document', 'actions de documents'],
        'Portable Text',
        'Perspectives',
        'Releases',
      ],
      shouldNotContain: [
        'Texte portable', // literal French translation of Portable Text
        'Versions', // common French translation of Releases
      ],
      description:
        'Uses approved terms (jeu de données, action de document) and preserves product names ' +
        '(Portable Text, Perspectives, Releases) in English',
    },
    qualityCriteria:
      'Must use approved glossary translations: "jeu de données" for dataset, "action de document" for document action, "champ" for field. ' +
      'An approved term counts as used when it appears in its natural inflected form ' +
      '("jeux de données", "actions de document"); do not penalise pluralisation or agreement. ' +
      'Must preserve Sanity product names exactly: "Portable Text" (not "Texte portable"), ' +
      '"Perspectives" (not "Points de vue"), "Releases" (not "Versions" or "Publications"), ' +
      '"Content Lake", "GROQ", "Studio". Use formal register per style guide.',
    baselineRisks: [
      'Model will translate "Portable Text" to "Texte portable" (looks like generic English)',
      'Model will translate "Releases" to "Versions" or "Publications"',
      'Model may keep "dataset" in English instead of using "jeu de données"',
      'Model may translate "document action" inconsistently without glossary',
    ],
  },
]

describe('Model eval: Glossary term compliance (French)', () => {
  it.each(cases)(
    '$id: $description',
    async (evalCase) => {
      const result = await runSampledComparison(evalCase)
      console.log(formatComparisonReport(evalCase, result))

      expect(result.deterministicPassFraction).toBeGreaterThanOrEqual(
        MIN_DETERMINISTIC_PASS_FRACTION,
      )
      expect(result.meanJudge.withContext.termAccuracy).toBeGreaterThanOrEqual(
        MIN_PRIMARY_DIMENSION_SCORE,
      )
      expect(result.meanJudge.withContext.overall).toBeGreaterThanOrEqual(MIN_JUDGE_OVERALL)
      expect(result.meanQualityDelta).toBeGreaterThanOrEqual(MIN_MEAN_QUALITY_DELTA)
    },
    EVAL_CASE_TIMEOUT_MS,
  )
})
