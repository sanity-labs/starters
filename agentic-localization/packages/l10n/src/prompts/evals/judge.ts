import type {JudgeScore, ModelEvalCase} from './model-eval-types'
import {stripJsonFence} from '../../core/stripJsonFence'
import {getClient} from './client'

/**
 * Grader configuration — pinned, and deliberately not the generator.
 *
 * Translations come from `agent.action.translate`; grading runs through
 * `agent.action.prompt`, so a translation is never graded by the same call that
 * produced it. Agent Actions exposes no model selector (there is no `model`
 * field on the prompt request in @sanity/client v7, nor in the Agent Actions
 * HTTP API), so the grader is pinned by the two knobs that do exist: the action
 * it runs through, and temperature. Pin the model here if a selector ships.
 */
const GRADER_TEMPERATURE = 0

/** Rubric scale. Stated to the grader verbatim and enforced when parsing. */
const RUBRIC_MIN = 1
const RUBRIC_MAX = 5

/**
 * The four graded dimensions, their weights in `overall`, and the anchors the
 * grader is given. Single source of truth: the instruction is generated from
 * this table, so prompt and weighting cannot drift apart.
 */
const RUBRIC = {
  fluency: {
    weight: 0.25,
    criterion: 'how natural and grammatically correct the translation reads in the target language',
    anchors: `${RUBRIC_MAX} = native quality, ${RUBRIC_MIN} = machine-translation-obvious`,
  },
  termAccuracy: {
    weight: 0.3,
    criterion: 'whether glossary terms use the specified approved translations',
    anchors: `${RUBRIC_MAX} = all terms correct, ${RUBRIC_MIN} = most terms wrong or missing`,
  },
  formalityMatch: {
    weight: 0.2,
    criterion: 'whether the translation matches the requested formality level',
    anchors: `${RUBRIC_MAX} = perfect match, ${RUBRIC_MIN} = completely wrong register`,
  },
  preservation: {
    weight: 0.25,
    criterion:
      'whether Do-Not-Translate terms, brand names, and placeholders are preserved unchanged',
    anchors: `${RUBRIC_MAX} = all preserved, ${RUBRIC_MIN} = most altered`,
  },
} as const

type Dimension = keyof typeof RUBRIC

const DIMENSIONS: Dimension[] = ['fluency', 'termAccuracy', 'formalityMatch', 'preservation']

const RUBRIC_LINES = DIMENSIONS.map(
  (dimension) =>
    `- "${dimension}": integer ${RUBRIC_MIN}-${RUBRIC_MAX} — ${RUBRIC[dimension].criterion} (${RUBRIC[dimension].anchors})`,
).join('\n')

/**
 * Read one graded dimension. Scores are single integers on the rubric scale —
 * anything else is a grader malfunction and fails the run rather than being
 * coerced. Only these numbers are parsed; the grader's prose is never scored.
 */
function readDimension(payload: Record<string, unknown>, dimension: Dimension): number {
  const value = Number(payload[dimension])
  if (!Number.isInteger(value) || value < RUBRIC_MIN || value > RUBRIC_MAX) {
    throw new Error(
      `Grader returned an out-of-rubric "${dimension}": ${JSON.stringify(payload[dimension])} ` +
        `(expected integer ${RUBRIC_MIN}-${RUBRIC_MAX})`,
    )
  }
  return value
}

export async function judgeTranslation(options: {
  sourceText: string
  translation: string
  sourceLocale: string
  targetLocale: string
  evalCase: ModelEvalCase
}): Promise<JudgeScore> {
  const {sourceText, translation, sourceLocale, targetLocale, evalCase} = options
  const client = getClient()

  const instruction =
    'You are a professional translation quality assessor. ' +
    `Score the translation on each dimension from ${RUBRIC_MIN}-${RUBRIC_MAX}. Be strict but fair. ` +
    'Evaluate against the requirements below regardless of what tools the translator had.\n\n' +
    `## Source Text (${sourceLocale})\n${sourceText}\n\n` +
    `## Translation (${targetLocale})\n${translation}\n\n` +
    `## Requirements\n${evalCase.qualityCriteria}\n` +
    `Formality: ${evalCase.styleGuide?.formality ?? 'not specified'}\n` +
    `Tone: ${evalCase.styleGuide?.tone?.join(', ') ?? 'not specified'}\n\n` +
    'Respond with a JSON object containing exactly these fields, in this order:\n' +
    '- "reasoning": string — one sentence, at most 200 characters. Justification only; it is not scored.\n' +
    `${RUBRIC_LINES}\n` +
    'Every score must be a bare integer. Do not add fields, ranges, or units.'

  const response = await client.agent.action.prompt({
    instruction,
    format: 'json',
    temperature: GRADER_TEMPERATURE,
  })

  // The SDK returns a parsed object when format is 'json', or a string otherwise
  const parsed = typeof response === 'string' ? JSON.parse(stripJsonFence(response)) : response

  const scores = {
    fluency: readDimension(parsed, 'fluency'),
    termAccuracy: readDimension(parsed, 'termAccuracy'),
    formalityMatch: readDimension(parsed, 'formalityMatch'),
    preservation: readDimension(parsed, 'preservation'),
  }

  const overall =
    Math.round(
      DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension] * RUBRIC[dimension].weight, 0) *
        100,
    ) / 100

  return {...scores, overall, reasoning: String(parsed.reasoning ?? '')}
}
