import type {PlaywrightContext} from 'racejar/playwright'
import {Given as G, When as W, Then as T, type StepDefinitionCallback} from 'racejar'

export const Given = <A = undefined, B = undefined, C = undefined>(
  text: string,
  callback: StepDefinitionCallback<PlaywrightContext, A, B, C>,
) => G<PlaywrightContext, A, B, C>(text, callback)

export const When = <A = undefined, B = undefined, C = undefined>(
  text: string,
  callback: StepDefinitionCallback<PlaywrightContext, A, B, C>,
) => W<PlaywrightContext, A, B, C>(text, callback)

export const Then = <A = undefined, B = undefined, C = undefined>(
  text: string,
  callback: StepDefinitionCallback<PlaywrightContext, A, B, C>,
) => T<PlaywrightContext, A, B, C>(text, callback)

export type {PlaywrightContext}
