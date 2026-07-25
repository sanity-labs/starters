/**
 * J1 — a publish runs through to an approved localization. Mode P.
 */

import type {L10nContext} from '../fixtures/context'

import {After, Before, Given} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, beforeAll} from 'vitest'

import {publishArticle} from '../fixtures/content'
import {resetContext} from '../fixtures/context'
import {createHarness} from '../fixtures/harness'
import {modePSteps, runSteps} from '../fixtures/steps'
import featureText from './publish-to-approved.feature?raw'

const harness = createHarness('P')

beforeAll(() => harness.deploy())
afterAll(() => harness.dispose())

Feature<L10nContext>({
  featureText,
  hooks: [
    // racejar compiles one context object per feature and reuses it for every
    // scenario, so a scenario that does not clear it inherits the last one's state.
    Before<L10nContext>((context) => {
      resetContext(context)
      context.harness = harness
    }),
    // Release the run's lake guards and delete its documents before the next
    // scenario asserts on them.
    After<L10nContext>(() => harness.resetScenario()),
  ],
  stepDefinitions: [
    Given<L10nContext>('a published article', async (context) => {
      context.subject = await publishArticle(harness, {title: 'Bench-tested localization'})
    }),
    ...runSteps,
    ...modePSteps,
  ],
})
