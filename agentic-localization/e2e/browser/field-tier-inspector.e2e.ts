/**
 * B3 — the field tier in the browser. Same inspector, no sibling documents.
 */

import type {StudioJourney} from './context'

import {After, Before} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll} from 'vitest'

import {resetContext} from '../fixtures/context'
import {readMatrixFixture} from './fixture'
import {gateFeature, probeGate} from './gate'
import {openSession, STUDIO_ORIGIN} from './session'
import {studioSteps} from './steps'
import featureText from './field-tier-inspector.feature?raw'

const SUBJECT = {type: 'person', id: 'person-elena-vasquez', field: 'bio'}

const session = await openSession(STUDIO_ORIGIN, 'field-tier')

const fixture = await probeGate(session, () => readMatrixFixture(session, SUBJECT))

let scenario = 0

afterAll(() => session.close())

Feature<StudioJourney>({
  featureText: gateFeature(featureText, {
    '@requires-sample-data': fixture.missing,
    '@requires-changed-locale': fixture.unchanged,
  }),
  hooks: [
    Before<StudioJourney>((context) => {
      resetContext(context)
      context.session = session
      context.locale = fixture.locale
      context.localeTitle = fixture.localeTitle
    }),
    After<StudioJourney>(async (context) => {
      scenario += 1
      await context.session.shot(`${scenario}`)
    }),
  ],
  stepDefinitions: studioSteps,
})
