/**
 * B4 — the translations dashboard. Written, tagged, and skipped: see the
 * feature's own preamble for why, and `../README.md` for where that leaves the
 * coverage line.
 */

import type {StudioJourney} from './context'

import {After, Before, Then} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, expect} from 'vitest'

import {resetContext} from '../fixtures/context'
import {DASHBOARD_ORIGIN, openSession, settle} from './session'
import {gateFeature, type GateReason} from './gate'
import {contextAndAction} from './steps'
import featureText from './dashboard.feature?raw'

/** The App SDK's auth exchange leaves localhost for this. */
const LOGIN_HOST = 'sanity.io'

/** The App SDK boots, reads its session, and only then renders. */
const BOOT_SETTLE_MS = 12_000

const session = await openSession(DASHBOARD_ORIGIN, 'dashboard')

/**
 * Did the app render, or did the SDK bounce the tab to the login page?
 *
 * Standalone (no dashboard iframe), the App SDK reads the suite's injected
 * `__sanity_auth_token` from `localStorage` — see `authTokenEntries` in
 * `session.ts` — so this normally passes. A bounce means the token was absent
 * or rejected; the probe reports where the tab actually ended up, so the skip
 * line is checkable rather than an assertion about the world.
 */
async function probeSession(): Promise<GateReason> {
  await session.goto('/')
  await session.page.waitForTimeout(BOOT_SETTLE_MS)
  await session.shot('gate')

  const landed = new URL(session.page.url())
  const onLoginHost = landed.hostname === LOGIN_HOST || landed.hostname.endsWith(`.${LOGIN_HOST}`)
  if (!onLoginHost) return undefined

  return (
    `the App SDK sent the tab to ${landed.origin}${landed.pathname} — the dashboard ` +
    'authenticates by stamped-token exchange, which an automated browser cannot ' +
    'complete. Log in at ' +
    `${DASHBOARD_ORIGIN} by hand to exercise these.`
  )
}

const sessionBlocked = await probeSession()

let scenario = 0

afterAll(() => session.close())

Feature<StudioJourney>({
  featureText: gateFeature(featureText, '@requires-auth', sessionBlocked),
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
  stepDefinitions: [
    ...contextAndAction<undefined>('the dashboard is open', async (context) => {
      await context.session.goto('/')
    }),

    Then<StudioJourney, string>('the page heading is {string}', async (context, heading) => {
      await settle(
        context.session.page.getByRole('heading', {name: heading}),
        `the "${heading}" heading`,
        context.session.page,
      )
    }),

    Then<StudioJourney>('the dashboard greets the signed-in user', async (context) => {
      await settle(
        context.session.page.getByText(/^Welcome back, /),
        'the welcome header',
        context.session.page,
      )
    }),

    Then<StudioJourney>(
      'the dashboard shows a status card per translation status',
      async (context) => {
        const cards = context.session.page.getByRole('button', {name: / translations/})
        await settle(cards.first(), 'the first status card', context.session.page)
        expect(await cards.count()).toBeGreaterThan(1)
      },
    ),

    Then<StudioJourney, string>(
      'the {string} section is announced to assistive tech',
      async (context, name) => {
        await settle(
          context.session.page.getByRole('region', {name}),
          `the "${name}" landmark region`,
          context.session.page,
        )
      },
    ),

    Then<StudioJourney>('every heatmap cell reports a percentage', async (context) => {
      const cells = context.session.page.getByRole('button', {name: /% translated/})
      await settle(cells.first(), 'the first heatmap cell', context.session.page)
      expect(await cells.count()).toBeGreaterThan(0)
    }),
  ],
})
