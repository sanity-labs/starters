import {describe, it, expect} from 'vitest'
import {techGlossary, styleGuideForLocale, sourceTexts} from './fixtures'
import {runBaselineComparison} from './model-scoring'
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
        'jeu de données',
        'action de document',
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
      expect(comparison.withContext.score.judge.termAccuracy).toBeGreaterThanOrEqual(4)
      expect(comparison.qualityDelta).toBeGreaterThanOrEqual(0)
    },
    120_000,
  )
})
