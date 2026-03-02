import type {JudgeScore, ModelEvalCase} from './model-eval-types'
import {getClient} from './client'

const WEIGHTS = {
  fluency: 0.25,
  termAccuracy: 0.3,
  formalityMatch: 0.2,
  preservation: 0.25,
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
    'Score the translation on each dimension from 1-5. Be strict but fair. ' +
    'Evaluate against the requirements below regardless of what tools the translator had.\n\n' +
    `## Source Text (${sourceLocale})\n${sourceText}\n\n` +
    `## Translation (${targetLocale})\n${translation}\n\n` +
    `## Requirements\n${evalCase.qualityCriteria}\n` +
    `Formality: ${evalCase.styleGuide?.formality ?? 'not specified'}\n` +
    `Tone: ${evalCase.styleGuide?.tone?.join(', ') ?? 'not specified'}\n\n` +
    'Score this translation and respond with a JSON object containing exactly these fields:\n' +
    '- "fluency": integer 1-5 — how natural and grammatically correct the translation reads in the target language (5 = native quality, 1 = machine-translation-obvious)\n' +
    '- "termAccuracy": integer 1-5 — whether glossary terms were translated using the specified approved translations (5 = all terms correct, 1 = most terms wrong or missing)\n' +
    '- "formalityMatch": integer 1-5 — whether the translation matches the requested formality level (5 = perfect match, 1 = completely wrong register)\n' +
    '- "preservation": integer 1-5 — whether Do-Not-Translate terms, brand names, and placeholders are preserved unchanged (5 = all preserved, 1 = most altered)\n' +
    '- "reasoning": string — brief explanation of the scores'

  const response = await client.agent.action.prompt({
    instruction,
    format: 'json',
  })

  // The SDK returns a parsed object when format is 'json', or a string otherwise
  const parsed =
    typeof response === 'string'
      ? JSON.parse(response.replace(/^```json\s*|\s*```$/g, '').trim())
      : response

  const fluency = Number(parsed.fluency)
  const termAccuracy = Number(parsed.termAccuracy)
  const formalityMatch = Number(parsed.formalityMatch)
  const preservation = Number(parsed.preservation)
  const reasoning = String(parsed.reasoning ?? '')

  if (
    [fluency, termAccuracy, formalityMatch, preservation].some((n) => isNaN(n) || n < 1 || n > 5)
  ) {
    throw new Error(`Invalid judge scores: ${JSON.stringify(parsed)}`)
  }

  const overall =
    Math.round(
      (fluency * WEIGHTS.fluency +
        termAccuracy * WEIGHTS.termAccuracy +
        formalityMatch * WEIGHTS.formalityMatch +
        preservation * WEIGHTS.preservation) *
        100,
    ) / 100

  return {fluency, termAccuracy, formalityMatch, preservation, overall, reasoning}
}
