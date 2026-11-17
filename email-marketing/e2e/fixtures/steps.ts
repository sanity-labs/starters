import type {PlaywrightContext} from 'racejar/playwright'
import {Given as G, When as W, Then as T, type StepDefinition} from 'racejar'

// Racejar's conditional StepDefinitionCallback never gives a destructured first parameter
// a contextual type.
type Callback<A, B, C> = (
  context: PlaywrightContext,
  paramA: A,
  paramB: B,
  paramC: C,
) => Promise<void> | void

type StepFactory = <A = unknown, B = unknown, C = unknown>(
  text: string,
  callback: Callback<A, B, C>,
) => StepDefinition<PlaywrightContext, A, B, C>

export const Given = G as StepFactory
export const When = W as StepFactory
export const Then = T as StepFactory

export type {PlaywrightContext}
