/**
 * The live grader.
 *
 * Runs through `agent.action.prompt`, the same surface the translation evals
 * grade with (`packages/l10n/src/prompts/evals/judge.ts`) — so a skill eval needs
 * a Sanity project and a token, and no other model credentials. Agent Actions
 * exposes no model selector, so the grader is pinned by the two knobs that exist:
 * the action it runs through, and temperature.
 */

import {createClient, type SanityClient} from '@sanity/client'
import {getUserToken} from '@starter/l10n/credentials'

const API_VERSION = 'vX'

/** Routing and grading are classification, not composition. */
export const GRADER_TEMPERATURE = 0

/** A worker answering a developer's question is allowed a little variance. */
export const WORKER_TEMPERATURE = 0.2

let cached: SanityClient | undefined

export function graderClient(): SanityClient {
  if (cached) return cached

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_STUDIO_DATASET
  const token = getUserToken()

  if (!projectId || !dataset || !token) {
    const missing = [
      projectId ? undefined : 'SANITY_STUDIO_PROJECT_ID',
      dataset ? undefined : 'SANITY_STUDIO_DATASET',
      token ? undefined : 'SANITY_AUTH_TOKEN',
    ].filter((name) => name !== undefined)

    throw new Error(
      `[skill-evals] Missing credentials: ${missing.join(', ')}.\n` +
        'The live suite grades through Agent Actions, so it needs a real project and a token.\n' +
        '  - SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET: repo root .env\n' +
        '  - SANITY_AUTH_TOKEN: packages/l10n/.env (gitignored) or a `sanity login` session.\n' +
        'The deterministic suite (`pnpm --filter @starter/skill-evals test`) needs none of this.',
    )
  }

  cached = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
    requestTagPrefix: 'evals.skills',
  })
  return cached
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Everything variable in a prompt travels as an `instructionParams` constant,
 * never interpolated into the instruction string.
 *
 * Not a style choice: Agent Actions parses `$name` in an instruction as a
 * template variable and rejects the request when no param matches. Skill files
 * are full of `$fields`, `$effectStatus` and GROQ `$slug`, so inlining them
 * fails with a 400. Substituted values are not re-parsed.
 */
export type PromptParams = Record<string, string>

/** Ask for prose. */
export async function promptText(
  instruction: string,
  params: PromptParams,
  temperature: number,
): Promise<string> {
  const response = await graderClient().agent.action.prompt({
    instruction,
    instructionParams: params,
    temperature,
  })
  return typeof response === 'string' ? response : JSON.stringify(response)
}

/** Ask for a JSON object, and fail loudly rather than coercing a bad shape. */
export async function promptJson(
  instruction: string,
  params: PromptParams,
  temperature = GRADER_TEMPERATURE,
): Promise<Record<string, unknown>> {
  const response = await graderClient().agent.action.prompt({
    instruction,
    instructionParams: params,
    format: 'json',
    temperature,
  })

  const parsed =
    typeof response === 'string'
      ? JSON.parse(response.replace(/^```json\s*|\s*```$/g, '').trim())
      : response

  if (!isRecord(parsed)) {
    throw new Error(`Grader returned ${typeof parsed}, expected a JSON object`)
  }
  return parsed
}

export function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string') {
    throw new Error(`Grader response has no string "${key}": ${JSON.stringify(payload)}`)
  }
  return value
}

/**
 * Read a rubric score. Anything off the scale is a grader malfunction and fails
 * the run rather than being clamped into range.
 */
export function readScore(value: unknown, min: number, max: number): number {
  const score = Number(value)
  if (!Number.isInteger(score) || score < min || score > max) {
    throw new Error(`Out-of-rubric score ${JSON.stringify(value)} (expected integer ${min}-${max})`)
  }
  return score
}

/** Run tasks with a small concurrency cap — live actions rate-limit. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index])
    }
  }

  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker))
  return results
}
