import type {EvalCase, ScoreResult} from './types'

/**
 * A model eval case tests actual translation quality by calling the
 * Sanity Agent Action Translate API and grading the result.
 */
export interface ModelEvalCase extends EvalCase {
  /** Deterministic checks applied to the TRANSLATION output (not the assembled prompt) */
  translationExpectations: {
    shouldContain?: string[]
    shouldNotContain?: string[]
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

/** Combined score from both deterministic and judge layers */
export interface TranslationScore {
  deterministic: ScoreResult
  judge: JudgeScore
  /** Pass = deterministic.pass AND judge.overall >= threshold */
  pass: boolean
}

/** Paired result: with-context vs without-context translations */
export interface BaselineComparison {
  withContext: {
    translation: TranslationResult
    score: TranslationScore
  }
  withoutContext: {
    translation: TranslationResult
    score: TranslationScore
  }
  /** judge.overall(withContext) - judge.overall(withoutContext) */
  qualityDelta: number
}
