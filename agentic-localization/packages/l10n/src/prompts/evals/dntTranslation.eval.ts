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
    id: 'model-dnt-ja-description',
    description: 'Japanese translation preserves all Sanity product names in Latin script',
    sourceText: sourceTexts.productDescription,
    sourceLocale: 'en-US',
    targetLocale: 'ja-JP',
    glossaries: [techGlossary],
    styleGuide: styleGuideForLocale('ja-JP'),
    fieldPath: 'excerpt',
    expectations: {
      shouldContain: [
        'Content Lake',
        'Do Not Translate',
        'Portable Text',
        'Perspectives',
        'Releases',
      ],
      description: 'Prompt lists all Sanity product terms as DNT',
    },
    translationExpectations: {
      shouldContain: ['Content Lake', 'Portable Text', 'GROQ', 'Perspectives', 'Releases'],
      shouldNotContain: [
        'コンテンツレイク', // katakana transliteration of Content Lake
        'ポータブルテキスト', // katakana transliteration of Portable Text
        'パースペクティブ', // katakana transliteration of Perspectives
        'リリース', // katakana transliteration of Releases
      ],
      description:
        'All Sanity product names must stay in Latin script, ' +
        'not transliterated to katakana or translated literally',
    },
    qualityCriteria:
      'Must preserve Sanity product names in Latin script: "Content Lake", "Portable Text", ' +
      '"GROQ", "Perspectives", "Releases", "Studio". These are product feature names, not generic English words. ' +
      'Must NOT transliterate to katakana (e.g., コンテンツレイク, ポータブルテキスト, パースペクティブ, リリース). ' +
      'Should use approved glossary terms: データセット for dataset, フィールド for field, ドキュメントアクション for document action. ' +
      'Should use desu/masu (です/ます) form and full-width punctuation per style guide.',
    baselineRisks: [
      'Model will transliterate "Portable Text" to ポータブルテキスト — it looks like a generic phrase',
      'Model will transliterate "Releases" to リリース — common loanword in Japanese',
      'Model will transliterate "Perspectives" to パースペクティブ',
      'Model may transliterate "Content Lake" to コンテンツレイク',
    ],
  },
]

describe('Model eval: DNT term preservation (Japanese)', () => {
  it.each(cases)(
    '$id: $description',
    async (evalCase) => {
      const result = await runSampledComparison(evalCase)
      console.log(formatComparisonReport(evalCase, result))

      expect(result.deterministicPassFraction).toBeGreaterThanOrEqual(
        MIN_DETERMINISTIC_PASS_FRACTION,
      )
      expect(result.meanJudge.withContext.preservation).toBeGreaterThanOrEqual(
        MIN_PRIMARY_DIMENSION_SCORE,
      )
      expect(result.meanJudge.withContext.overall).toBeGreaterThanOrEqual(MIN_JUDGE_OVERALL)
      expect(result.meanQualityDelta).toBeGreaterThanOrEqual(MIN_MEAN_QUALITY_DELTA)
    },
    EVAL_CASE_TIMEOUT_MS,
  )
})
