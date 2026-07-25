import {resolveLocaleDefaults} from '../../core/utils'
import {scorePrompt} from './scoring'
import {judgeTranslation} from './judge'
import {translateDocument} from './translate'
import type {
  ComparisonSample,
  JudgeDimensions,
  JudgeScore,
  ModelEvalCase,
  SampledComparison,
  TranslationResult,
  TranslationScore,
} from './model-eval-types'
import {enUS} from './fixtures'

// A single live-model draw is too noisy to gate on: byte-identical prompt
// assembly has produced three different marginal failures on three consecutive
// runs. Every case therefore draws N translations per arm and asserts on the
// aggregate. Translate runs at the Agent Action default temperature of 0 — the
// draws still differ because the serving stack is not bit-deterministic, and
// that is exactly the production noise these thresholds have to absorb.

/** Translation draws per case, per arm. Raise for a deeper (slower, costlier) run. */
export const SAMPLES_PER_CASE = positiveInt(process.env.EVAL_SAMPLES, 3)

/**
 * Judge calls per translation, averaged. Grader variance is the larger noise
 * source of the two: a single outlier draw has swung one sample's delta by more
 * than a full point, so translations are graded three times and averaged.
 */
const JUDGE_TRIALS_PER_SAMPLE = 3

/** Deterministic checks must fully pass in at least this share of with-context samples. */
export const MIN_DETERMINISTIC_PASS_FRACTION = 2 / 3

/** Mean score (1-5) the dimension a case exists to test must reach across samples. */
export const MIN_PRIMARY_DIMENSION_SCORE = 4

/** Mean weighted judge score (1-5) the with-context arm must reach across samples. */
export const MIN_JUDGE_OVERALL = 3.5

/**
 * How far apart two equally good translations land on the weighted 1-5 scale.
 *
 * Measured, not guessed: with both arms at ceiling, per-sample deltas of -0.2,
 * +0.1 and -0.2 have been observed across nine grader draws each. A real defect
 * is bigger — one dimension slipping 5 to 3 moves `overall` by 0.4 (formality)
 * to 0.6 (terms) — so this floor separates noise from regression. It sets both
 * the delta gate below and the win/loss/tie classification in the report.
 */
const JUDGE_NOISE_FLOOR = 0.25

/**
 * Aggregate gate on with-context vs without-context quality.
 *
 * `qualityDelta >= 0` on one draw is a coin flip whenever both arms are good,
 * and the Translate action already handles much of this source text well, so the
 * baseline arm often saturates. The claim this gate can honestly make is "context
 * does not make the translation worse"; that context *helps* is what the
 * deterministic layer proves.
 *
 * The gate is the mean, not the win/loss sign test: a sign test discards
 * magnitude, so one grader draw landing 0.3 low has failed a case whose mean
 * delta was -0.03. Wins, losses and ties are reported as diagnostics instead.
 */
export const MIN_MEAN_QUALITY_DELTA = -JUDGE_NOISE_FLOOR

/** Wall-clock budget for one sample: two translations plus six judge calls. */
const SAMPLE_BUDGET_MS = 90_000

/** Per-case timeout, scaled to the sample count so EVAL_SAMPLES stays usable. */
export const EVAL_CASE_TIMEOUT_MS = SAMPLES_PER_CASE * SAMPLE_BUDGET_MS

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function mean(values: number[]): number {
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100
}

function meanDimensions(scores: JudgeDimensions[]): JudgeDimensions {
  return {
    fluency: mean(scores.map((s) => s.fluency)),
    termAccuracy: mean(scores.map((s) => s.termAccuracy)),
    formalityMatch: mean(scores.map((s) => s.formalityMatch)),
    preservation: mean(scores.map((s) => s.preservation)),
    overall: mean(scores.map((s) => s.overall)),
  }
}

/**
 * Deterministic checks run per sample; their pass fraction is reported by the
 * caller rather than being collapsed into the judge score.
 */
export async function scoreTranslation(options: {
  translation: TranslationResult
  evalCase: ModelEvalCase
}): Promise<TranslationScore> {
  const {translation, evalCase} = options

  const deterministic = scorePrompt(translation.fieldText, evalCase.translationExpectations)

  const judges = await Promise.all(
    Array.from({length: JUDGE_TRIALS_PER_SAMPLE}, () =>
      judgeTranslation({
        sourceText: evalCase.sourceText,
        translation: translation.fieldText,
        sourceLocale: evalCase.sourceLocale,
        targetLocale: evalCase.targetLocale,
        evalCase,
      }),
    ),
  )

  const judge: JudgeScore = {...meanDimensions(judges), reasoning: judges[0].reasoning}

  return {
    deterministic,
    judge,
    pass: deterministic.pass && judge.overall >= MIN_JUDGE_OVERALL,
  }
}

async function runComparisonSample(
  evalCase: ModelEvalCase,
  index: number,
): Promise<ComparisonSample> {
  const targetLocale = {
    code: evalCase.targetLocale,
    ...resolveLocaleDefaults(evalCase.targetLocale),
  }

  const [withContextTranslation, withoutContextTranslation] = await Promise.all([
    translateDocument({
      targetLocale,
      sourceLocale: enUS,
      glossaries: evalCase.glossaries,
      styleGuide: evalCase.styleGuide,
      fieldPath: evalCase.fieldPath,
    }),
    translateDocument({
      targetLocale,
      sourceLocale: enUS,
      fieldPath: evalCase.fieldPath,
    }),
  ])

  const [withContext, withoutContext] = await Promise.all([
    scoreTranslation({translation: withContextTranslation, evalCase}),
    scoreTranslation({translation: withoutContextTranslation, evalCase}),
  ])

  return {
    index,
    withContext: {translation: withContextTranslation, score: withContext},
    withoutContext: {translation: withoutContextTranslation, score: withoutContext},
    qualityDelta:
      Math.round((withContext.judge.overall - withoutContext.judge.overall) * 100) / 100,
  }
}

/**
 * Samples run one after another: the Agent Actions API rate-limits bursts, and
 * six judge calls per sample is already the concurrency this suite can spend.
 */
export async function runSampledComparison(evalCase: ModelEvalCase): Promise<SampledComparison> {
  const samples: ComparisonSample[] = []
  for (let index = 1; index <= SAMPLES_PER_CASE; index++) {
    samples.push(await runComparisonSample(evalCase, index))
  }

  const deterministicPasses = samples.filter((s) => s.withContext.score.deterministic.pass).length

  return {
    samples,
    deterministicPassFraction: deterministicPasses / samples.length,
    meanJudge: {
      withContext: meanDimensions(samples.map((s) => s.withContext.score.judge)),
      withoutContext: meanDimensions(samples.map((s) => s.withoutContext.score.judge)),
    },
    meanQualityDelta: mean(samples.map((s) => s.qualityDelta)),
    wins: samples.filter((s) => s.qualityDelta > JUDGE_NOISE_FLOOR).length,
    losses: samples.filter((s) => s.qualityDelta < -JUDGE_NOISE_FLOOR).length,
    ties: samples.filter((s) => Math.abs(s.qualityDelta) <= JUDGE_NOISE_FLOOR).length,
  }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function fraction(passes: number, total: number): string {
  if (total === 0) return `${passes}/${total}`
  return `${passes}/${total} (${Math.round((passes / total) * 100)}%)`
}

/**
 * Per-sample outcomes plus the aggregate the assertions use. Full translations
 * are printed only for samples that failed a deterministic check or lost to the
 * baseline — that is where the text is worth reading.
 */
export function formatComparisonReport(evalCase: ModelEvalCase, result: SampledComparison): string {
  const lines: string[] = []
  const total = result.samples.length
  const translateCalls = total * 2
  const judgeCalls = translateCalls * JUDGE_TRIALS_PER_SAMPLE

  lines.push(`\n--- ${evalCase.id} — ${total} samples ---`)

  for (const sample of result.samples) {
    const {deterministic, judge} = sample.withContext.score
    const durationS = Math.round(
      (sample.withContext.translation.durationMs + sample.withoutContext.translation.durationMs) /
        1000,
    )
    lines.push(
      `sample ${sample.index}: deterministic ${deterministic.pass ? 'pass' : 'FAIL'} ` +
        `${fraction(deterministic.passed, deterministic.total)} | ` +
        `judge ${judge.overall} vs ${sample.withoutContext.score.judge.overall} | ` +
        `delta ${signed(sample.qualityDelta)} | ${durationS}s`,
    )
    if (deterministic.details.length) {
      lines.push(`  ${deterministic.details.join('; ')}`)
    }
    if (!deterministic.pass || sample.qualityDelta < -JUDGE_NOISE_FLOOR) {
      lines.push(`  with context:    "${sample.withContext.translation.fieldText}"`)
      lines.push(`  without context: "${sample.withoutContext.translation.fieldText}"`)
      lines.push(`  judge said: ${judge.reasoning}`)
    }
  }

  const {withContext, withoutContext} = result.meanJudge
  const deterministicPasses = result.samples.filter(
    (s) => s.withContext.score.deterministic.pass,
  ).length
  lines.push(
    `deterministic pass: ${fraction(deterministicPasses, total)} ` +
      `(min ${Math.round(MIN_DETERMINISTIC_PASS_FRACTION * 100)}%)`,
  )
  lines.push(
    `judge mean (with):    fluency ${withContext.fluency} | terms ${withContext.termAccuracy} | ` +
      `formality ${withContext.formalityMatch} | preservation ${withContext.preservation} | ` +
      `overall ${withContext.overall}`,
  )
  lines.push(
    `judge mean (without): fluency ${withoutContext.fluency} | terms ${withoutContext.termAccuracy} | ` +
      `formality ${withoutContext.formalityMatch} | preservation ${withoutContext.preservation} | ` +
      `overall ${withoutContext.overall}`,
  )
  lines.push(
    `mean delta ${signed(result.meanQualityDelta)} (min ${MIN_MEAN_QUALITY_DELTA}) | ` +
      `not gated: wins ${result.wins} / losses ${result.losses} / ties ${result.ties}`,
  )
  lines.push(`model calls: ${translateCalls} translate + ${judgeCalls} judge`)

  return lines.join('\n')
}
