import type {EvalCase, ExpectedTerm, ScoreResult} from './types'

/**
 * A model eval case tests actual translation quality by calling the
 * Sanity Agent Action Translate API and grading the result.
 */
export interface ModelEvalCase extends EvalCase {
  /** Deterministic checks applied to the TRANSLATION output (not the assembled prompt) */
  translationExpectations: {
    shouldContain?: ExpectedTerm[]
    shouldNotContain?: ExpectedTerm[]
    shouldMatchPattern?: RegExp[]
    description: string
  }
  /** Human-readable criteria for the LLM judge */
  qualityCriteria: string
  /** Which document field to extract and grade (e.g. 'description') */
  fieldPath: string
}

/** Raw result from a single translate call */
export interface TranslationResult {
  /** The full returned document (noWrite: true) */
  document: Record<string, unknown>
  /** Extracted text from the target field */
  fieldText: string
  durationMs: number
}

/** LLM judge scores — 4 translation-quality dimensions, each 1-5 */
export interface JudgeScore {
  fluency: number
  termAccuracy: number
  formalityMatch: number
  preservation: number
  overall: number
  reasoning: string
}

/** Judge scores without the prose — what gets averaged across samples */
export type JudgeDimensions = Omit<JudgeScore, 'reasoning'>

/** Combined score from both deterministic and judge layers */
export interface TranslationScore {
  deterministic: ScoreResult
  judge: JudgeScore
  /** Pass = deterministic.pass AND judge.overall >= threshold */
  pass: boolean
}

/** One draw: with-context vs without-context translations of the same source */
export interface ComparisonSample {
  /** 1-based, for logging */
  index: number
  withContext: {
    translation: TranslationResult
    score: TranslationScore
  }
  withoutContext: {
    translation: TranslationResult
    score: TranslationScore
  }
  /** judge.overall(withContext) - judge.overall(withoutContext) for this draw */
  qualityDelta: number
}

/** Aggregate across N draws — this, not a single sample, is what cases assert on */
export interface SampledComparison {
  samples: ComparisonSample[]
  /** Share of samples where every deterministic check on the with-context arm passed */
  deterministicPassFraction: number
  /** Per-dimension means across samples, per arm */
  meanJudge: {
    withContext: JudgeDimensions
    withoutContext: JudgeDimensions
  }
  meanQualityDelta: number
  /** Reported, not gated — direction of each sample beyond the grader noise floor */
  wins: number
  losses: number
  ties: number
}
