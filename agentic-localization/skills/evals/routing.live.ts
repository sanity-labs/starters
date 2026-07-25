/**
 * Description discriminability.
 *
 * Each query is shown to the grader with the roster and nothing else — no
 * expectation, no skill body, no repo. That measures the only thing a real
 * harness has when it decides whether to load a skill: the description.
 *
 * Read the score as an upper bound, not as live trigger precision. The real
 * loader may truncate descriptions, weight them differently, or let the model
 * skip a skill it thinks it can answer unaided.
 *
 * Pass bar, per case kind:
 *  - positive: every one must land on its skill. A miss is a failure.
 *  - negative: at most one may be captured by either skill under test.
 *  - ambiguous: reported, never gated. Both answers are defensible.
 */

import {beforeAll, describe, expect, test} from 'vitest'

import routingCases from './cases/routing.json' with {type: 'json'}

import {SKILL_NAMES} from './corpus'
import {pool, promptJson, readString} from './grader'
import {rosterNames, rosterText} from './roster'

const TRIALS = Number(process.env.GRADER_TRIALS ?? 1)
const CONCURRENCY = 4

interface Decision {
  id: string
  kind: string
  expected: string
  chosen: string[]
  /** The majority answer across trials. */
  verdict: string
  passed: boolean
}

/** Roster and query travel as params — see `promptParams` in `grader.ts`. */
const INSTRUCTION =
  'You are the skill router inside a coding agent. Exactly one of the skills below may be ' +
  'loaded to help with the request, or none of them if none is the right home for it.\n\n' +
  '## Available skills\n$roster\n\n## Request\n$request\n\n' +
  'Choose the single best skill, or "none" if no skill on the list is the right home. ' +
  'Prefer "none" over a skill that merely shares vocabulary with the request.\n' +
  'Respond with a JSON object containing exactly these fields:\n' +
  '- "reasoning": string, at most 200 characters. Not scored.\n' +
  '- "skill": string — one of $choices\n'

function majority(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** A negative fails only if a skill under test captured it. Any other home is fine. */
function isUnderTest(name: string): boolean {
  return SKILL_NAMES.some((skillName) => skillName === name)
}

const decisions: Decision[] = []

describe('description discriminability', () => {
  beforeAll(async () => {
    const resolved = await pool(routingCases, CONCURRENCY, async (routingCase) => {
      const chosen: string[] = []
      for (let trial = 0; trial < TRIALS; trial++) {
        const payload = await promptJson(INSTRUCTION, {
          roster: rosterText(),
          request: routingCase.query,
          choices: [...rosterNames(), 'none'].map((name) => `"${name}"`).join(', '),
        })
        chosen.push(readString(payload, 'skill').trim())
      }
      const verdict = majority(chosen)
      const passed =
        routingCase.kind === 'negative' ? !isUnderTest(verdict) : verdict === routingCase.expect

      return {
        id: routingCase.id,
        kind: routingCase.kind,
        expected: routingCase.expect,
        chosen,
        verdict,
        passed,
      }
    })

    decisions.push(...resolved)

    const byKind = new Map<string, Decision[]>()
    for (const decision of resolved) {
      byKind.set(decision.kind, [...(byKind.get(decision.kind) ?? []), decision])
    }
    for (const [kind, group] of byKind) {
      const passing = group.filter((decision) => decision.passed).length
      console.log(`[routing] ${kind}: ${passing}/${group.length}`)
      for (const decision of group.filter((entry) => !entry.passed)) {
        console.log(`  ✗ ${decision.id}: expected ${decision.expected}, got ${decision.verdict}`)
      }
    }
  })

  test.each(routingCases.filter((routingCase) => routingCase.kind === 'positive'))(
    'positive $id routes to $expect',
    (routingCase) => {
      const decision = decisions.find((entry) => entry.id === routingCase.id)
      expect(decision?.verdict).toBe(routingCase.expect)
    },
  )

  test('at most one hard negative is captured by a skill under test', () => {
    const negatives = decisions.filter((decision) => decision.kind === 'negative')
    const captured = negatives.filter((decision) => isUnderTest(decision.verdict))
    const detail = captured.map((decision) => `${decision.id} → ${decision.verdict}`).join(', ')
    expect(captured.length, `false fires: ${detail}`).toBeLessThanOrEqual(1)
  })

  test('ambiguous cases are reported, not gated', () => {
    const ambiguous = decisions.filter((decision) => decision.kind === 'ambiguous')
    for (const decision of ambiguous) {
      const agreed = decision.verdict === decision.expected
      console.log(
        `[routing] ambiguous ${decision.id}: ${decision.verdict}` +
          (agreed ? '' : ` (preferred ${decision.expected})`),
      )
    }
    // A collision finding even when routing lands as expected: an ambiguous
    // query that never reaches either skill means the trigger surface has a gap.
    const orphaned = ambiguous.filter((decision) => !isUnderTest(decision.verdict))
    expect(orphaned.map((decision) => `${decision.id} → ${decision.verdict}`)).toEqual([])
  })
})
