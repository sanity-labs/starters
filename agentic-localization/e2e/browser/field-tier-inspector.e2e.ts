/**
 * B3 — the field tier in the browser. Same inspector, no sibling documents.
 */

import type {StudioJourney} from './context'

import {After, Before} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll} from 'vitest'

import {resetContext} from '../fixtures/context'
import {openSession, STUDIO_ORIGIN} from './session'
import {studioSteps} from './steps'
import featureText from './field-tier-inspector.feature?raw'

const session = await openSession(STUDIO_ORIGIN, 'field-tier')

let scenario = 0

afterAll(() => session.close())

Feature<StudioJourney>({
  featureText,
  hooks: [
    Before<StudioJourney>((context) => {
      resetContext(context)
      context.session = session
    }),
    After<StudioJourney>(async (context) => {
      scenario += 1
      await context.session.shot(`${scenario}`)
    }),
  ],
  stepDefinitions: studioSteps,
})
