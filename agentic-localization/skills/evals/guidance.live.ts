/**
 * Does the guidance actually let an agent do the job?
 *
 * Two calls per draw, and they are deliberately separated:
 *  1. A worker gets only what a real invocation would see — the developer's
 *     prompt plus the skill files that scenario says would be loaded. No repo,
 *     no expectations, no rubric.
 *  2. A grader that never saw the corpus scores the worker's answer against the
 *     scenario's rubric, with anchors, one score per criterion.
 *
 * Between them sits a check the grader cannot argue with: did the answer name the
 * files, entries and commands the task needs. Naming the wrong file is the failure
 * mode that actually costs an adopter time.
 *
 * Aggregated over draws, for the same reason the translation evals are: a single
 * live draw swings a criterion between 1 and 5 depending on what the worker chose
 * to keep, and a suite that flaps teaches nothing. Criteria are weighted
 * `critical` or `minor` — a critical gap fails the case, one weak minor is a
 * short answer rather than a hole in the guidance.
 */

import {describe, expect, test} from 'vitest'

import scenarios from './cases/scenarios.json' with {type: 'json'}

import {corpusFor, isSkillName} from './corpus'
import {promptJson, promptText, readScore, WORKER_TEMPERATURE} from './grader'

type Scenario = (typeof scenarios)[number]

const RUBRIC_MIN = 1
const RUBRIC_MAX = 5

/** Independent worker draws per scenario, each graded. `GUIDANCE_SAMPLES` raises it. */
const SAMPLES = Number(process.env.GUIDANCE_SAMPLES ?? 2)

/**
 * A criterion averaging 3 is "addressed but thin". Below that the guidance did
 * not carry it, in any draw.
 */
const MIN_CRITERION = 3
const MIN_MEAN = 3.8

/** At most one minor criterion may fall short. Every critical one must hold. */
const MAX_WEAK_MINORS = 1

/**
 * A good answer summarises rather than transcribing, so it will not repeat every
 * token the corpus carries. It does have to land most of them: below this, the
 * agent is talking around the specifics instead of naming them.
 */
const MIN_NAMED_RATIO = 0.6

const ANCHORS =
  `${RUBRIC_MAX} = fully and specifically satisfied, with the concrete names, paths or commands the criterion implies; ` +
  `4 = satisfied, slightly thin; ${MIN_CRITERION} = addressed but vague or partial; ` +
  `2 = barely touched; ${RUBRIC_MIN} = absent, or contradicted`

async function answerFor(scenario: Scenario): Promise<string> {
  if (!isSkillName(scenario.skill)) throw new Error(`Unknown skill ${scenario.skill}`)

  const instruction =
    'You are a coding agent helping a developer. The reference material below is the only ' +
    'documentation you have; you cannot browse the repository. Answer the request using it. ' +
    'Be concrete: name the actual files, exports and commands involved.\n\n' +
    '## Reference material\n$corpus\n\n## Request\n$request'

  return promptText(
    instruction,
    {corpus: corpusFor(scenario.skill, scenario.load), request: scenario.prompt},
    WORKER_TEMPERATURE,
  )
}

async function gradeFor(scenario: Scenario, answer: string): Promise<number[]> {
  const criteria = scenario.rubric.map((entry, index) => `- "c${index}": ${entry.c}`).join('\n')

  const instruction =
    'You are grading an assistant answer against a fixed rubric. You have not seen the ' +
    'documentation the assistant was given: score only what the answer itself demonstrates. ' +
    'Be strict; a plausible-sounding answer that omits the specifics scores low.\n\n' +
    '## Request the assistant was answering\n$request\n\n' +
    '## The answer\n$answer\n\n' +
    `## Rubric — score each criterion ${RUBRIC_MIN}-${RUBRIC_MAX} (${ANCHORS})\n$rubric\n\n` +
    'Respond with a JSON object whose keys are exactly the criterion ids above, each an ' +
    'integer score. Do not add other fields.'

  const payload = await promptJson(instruction, {
    request: scenario.prompt,
    answer,
    rubric: criteria,
  })

  return scenario.rubric.map((_, index) => readScore(payload[`c${index}`], RUBRIC_MIN, RUBRIC_MAX))
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

describe('guidance quality', () => {
  test.for(scenarios)('$category/$id', {timeout: 600_000}, async (scenario) => {
    const draws = await Promise.all(
      Array.from({length: SAMPLES}, async () => {
        const answer = await answerFor(scenario)
        return {answer, scores: await gradeFor(scenario, answer)}
      }),
    )

    /** Per criterion, averaged across draws. */
    const averaged = scenario.rubric.map((_, index) =>
      mean(draws.map((draw) => draw.scores[index])),
    )
    const overall = mean(averaged)

    const weak = scenario.rubric
      .map((entry, index) => ({entry, score: averaged[index]}))
      .filter(({score}) => score < MIN_CRITERION)

    const weakCritical = weak.filter(({entry}) => entry.w === 'critical')
    const weakMinor = weak.filter(({entry}) => entry.w === 'minor')

    // Naming is measured on the best draw: one draw omitting a filename is
    // brevity, every draw omitting it is guidance that never said it.
    const namedRatios = draws.map((draw) => {
      const named = scenario.mustName.filter((needle) => draw.answer.includes(needle))
      return named.length / scenario.mustName.length
    })
    const bestNamed = Math.max(...namedRatios)
    const neverNamed = scenario.mustName.filter(
      (needle) => !draws.some((draw) => draw.answer.includes(needle)),
    )

    console.log(
      `[guidance] ${scenario.id}: named ${(bestNamed * 100).toFixed(0)}%, ` +
        `mean ${overall.toFixed(2)}, criteria ${averaged.map((score) => score.toFixed(1)).join('/')}` +
        (neverNamed.length ? `\n  never named: ${neverNamed.join(', ')}` : '') +
        weak
          .map(({entry, score}) => `\n  weak (${entry.w}, ${score.toFixed(1)}): ${entry.c}`)
          .join(''),
    )

    expect(bestNamed, `no draw named: ${neverNamed.join(', ')}`).toBeGreaterThanOrEqual(
      MIN_NAMED_RATIO,
    )
    expect(
      weakCritical.map(({entry}) => entry.c),
      'critical criteria the guidance did not carry',
    ).toEqual([])
    expect(
      weakMinor.length,
      `weak minors: ${weakMinor.map(({entry}) => entry.c).join('; ')}`,
    ).toBeLessThanOrEqual(MAX_WEAK_MINORS)
    expect(overall).toBeGreaterThanOrEqual(MIN_MEAN)
  })
})
