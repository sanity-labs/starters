/**
 * J2 — a reviewer sends one locale back. Mode P.
 */

import type {L10nContext} from '../fixtures/context'

import {After, Before, Given} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, beforeAll} from 'vitest'

import {publishArticle} from '../fixtures/content'
import {resetContext} from '../fixtures/context'
import {createHarness} from '../fixtures/harness'
import {modePSteps, runSteps} from '../fixtures/steps'
import featureText from './request-changes.feature?raw'

const harness = createHarness('P')

beforeAll(() => harness.deploy())
afterAll(() => harness.dispose())

Feature<L10nContext>({
  featureText,
  hooks: [
    Before<L10nContext>((context) => {
      resetContext(context)
      context.harness = harness
    }),
    After<L10nContext>(() => harness.resetScenario()),
  ],
  stepDefinitions: [
    Given<L10nContext>('a published article', async (context) => {
      context.subject = await publishArticle(harness, {title: 'Reviewer sends German back'})
    }),
    ...runSteps,
    ...modePSteps,
  ],
})
