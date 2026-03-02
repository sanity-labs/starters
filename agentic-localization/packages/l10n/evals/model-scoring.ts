import {resolveLocaleDefaults} from '../src/utils'
import {scorePrompt} from './scoring'
import {judgeTranslation} from './judge'
import {translateDocument} from './translate'
import type {
  ModelEvalCase,
  TranslationScore,
  TranslationResult,
  BaselineComparison,
  JudgeScore,
} from './model-eval-types'
import {enUS} from './fixtures'

const JUDGE_PASS_THRESHOLD = 3.5
const JUDGE_TRIALS = 3

function avg(values: number[]): number {
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100
}

/**
 * Score a single translation using deterministic checks and averaged LLM judge.
 * Runs the judge multiple times to smooth out scoring variance.
 */
export async function scoreTranslation(options: {
  translation: TranslationResult
  evalCase: ModelEvalCase
}): Promise<TranslationScore> {
  const {translation, evalCase} = options

  // Layer 1: deterministic checks on the translated field text
  const deterministic = scorePrompt(translation.fieldText, evalCase.translationExpectations)

  // Layer 2: LLM judge — run multiple trials and average to reduce variance
  const judges = await Promise.all(
    Array.from({length: JUDGE_TRIALS}, () =>
      judgeTranslation({
        sourceText: evalCase.sourceText,
        translation: translation.fieldText,
        sourceLocale: evalCase.sourceLocale,
        targetLocale: evalCase.targetLocale,
        evalCase,
      }),
    ),
  )

  const judge: JudgeScore = {
    fluency: avg(judges.map((j) => j.fluency)),
    termAccuracy: avg(judges.map((j) => j.termAccuracy)),
    formalityMatch: avg(judges.map((j) => j.formalityMatch)),
    preservation: avg(judges.map((j) => j.preservation)),
    overall: avg(judges.map((j) => j.overall)),
    reasoning: judges[0].reasoning,
  }

  return {
    deterministic,
    judge,
    pass: deterministic.pass && judge.overall >= JUDGE_PASS_THRESHOLD,
  }
}

/**
 * Run a full baseline comparison:
 * 1. Translate WITH context (glossaries + style guide)
 * 2. Translate WITHOUT context (bare instruction)
 * 3. Score both, compute quality delta
 */
export async function runBaselineComparison(evalCase: ModelEvalCase): Promise<BaselineComparison> {
  const targetLocale = {
    code: evalCase.targetLocale,
    ...resolveLocaleDefaults(evalCase.targetLocale),
  }

  // With context
  const withContextTranslation = await translateDocument({
    targetLocale,
    sourceLocale: enUS,
    glossaries: evalCase.glossaries,
    styleGuide: evalCase.styleGuide,
    fieldPath: evalCase.fieldPath,
  })

  // Without context (baseline)
  const withoutContextTranslation = await translateDocument({
    targetLocale,
    sourceLocale: enUS,
    fieldPath: evalCase.fieldPath,
  })

  // Score both
  const withContextScore = await scoreTranslation({
    translation: withContextTranslation,
    evalCase,
  })

  const withoutContextScore = await scoreTranslation({
    translation: withoutContextTranslation,
    evalCase,
  })

  return {
    withContext: {translation: withContextTranslation, score: withContextScore},
    withoutContext: {translation: withoutContextTranslation, score: withoutContextScore},
    qualityDelta: withContextScore.judge.overall - withoutContextScore.judge.overall,
  }
}
