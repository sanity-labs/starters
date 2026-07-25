/**
 * The object racejar threads through a scenario's steps.
 *
 * A type alias, not an interface: `Feature<TContext>` constrains its context to
 * `Record<string, any>`, and only an alias of an object literal type gets the
 * implicit index signature that satisfies it.
 *
 * racejar compiles ONE context object per feature and never replaces it between
 * scenarios, so a `Before` hook that does not clear it leaks the previous
 * scenario's state — hence `resetContext`.
 */

import type {Published} from './content'
import type {Harness} from './harness'

export type L10nContext = {
  harness: Harness
  /** The published source document the scenario is about. */
  subject: Published
  /** The run under test. */
  instanceId: string
  /** How many canned AI calls had been spent when the scenario reached its `When`. */
  agentCallsBefore: number
}

/** Clear every key. The parameter type is what lets this stay cast-free. */
export function resetContext(context: Record<string, unknown>): void {
  for (const key of Object.keys(context)) delete context[key]
}
