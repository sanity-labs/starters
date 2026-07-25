/**
 * B1 — the document tier in the browser: the inspector an editor actually
 * clicks, against the dev Studio and the dev dataset.
 */

import type {StudioJourney} from './context'

import {After, Before, Then, When} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, expect} from 'vitest'

import {resetContext} from '../fixtures/context'
import {gateFeature, type GateReason} from './gate'
import {openSession, settle, STUDIO_ORIGIN} from './session'
import {contextAndAction, studioSteps} from './steps'
import {documentPath, inspector, matrixRows, reviewAction} from './studio'
import featureText from './studio-review.feature?raw'

const SUBJECT = 'article-simultaneous-global-launch'

/** The verb the gate probes for. Its text comes from the workflow definition. */
const APPROVE = 'Approve'

/** Long enough to tell "not rendered" from "not rendered yet". */
const VERB_PROBE_MS = 10_000

const DIALOG = '#l10n-request-changes'

const session = await openSession(STUDIO_ORIGIN, 'studio-review')

/**
 * Can this browser fire a review verb?
 *
 * Two things have to hold, and neither is under the suite's control: the
 * subject needs an open run in `review` for the footer to render any verbs at
 * all, and the engine has to resolve an identity for the browser's session —
 * which it does not, because identity resolution here is account-global. The
 * probe reports whichever bit first, quoting the inspector's own notice so the
 * skip line says what an operator would have seen.
 */
async function probeReviewVerbs(): Promise<GateReason> {
  const {page} = session
  await session.goto(documentPath('article', SUBJECT, {inspect: 'translations'}))
  await settle(matrixRows(page).first(), 'the first locale row', page)

  const notice = (await inspector(page).innerText())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[1]

  const approve = reviewAction(page, APPROVE)
  try {
    await approve.waitFor({state: 'visible', timeout: VERB_PROBE_MS})
  } catch {
    return (
      `the inspector reported "${notice}" for ${SUBJECT}, so no review verb is offered — ` +
      'the engine session the verbs need resolves account-globally and the automated ' +
      'browser has none. Fire them by hand in a logged-in Studio.'
    )
  }

  if (await approve.isDisabled()) {
    return `"${APPROVE}" is rendered but disabled for ${SUBJECT} (inspector says "${notice}")`
  }
  return undefined
}

const verbsBlocked = await probeReviewVerbs()

let scenario = 0

afterAll(() => session.close())

Feature<StudioJourney>({
  featureText: gateFeature(featureText, '@requires-auth', verbsBlocked),
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
    ...contextAndAction<string>('the reviewer fires {string}', async (context, verb) => {
      await reviewAction(context.session.page, verb).click()
    }),

    Then<StudioJourney>('the review verb is accepted', async (context) => {
      // The engine closes the review activity, so the verb stops being offered.
      await reviewAction(context.session.page, APPROVE).waitFor({state: 'detached'})
    }),

    Then<StudioJourney>('the request-changes dialog is open', async (context) => {
      await settle(
        context.session.page.locator(DIALOG),
        'the request-changes dialog',
        context.session.page,
      )
    }),

    When<StudioJourney, string, string>(
      'the reviewer notes {string} and picks {string}',
      async (context, note, locale) => {
        const dialog = context.session.page.locator(DIALOG)
        await dialog.getByRole('textbox').fill(note)
        await dialog.getByLabel(locale).check()
      },
    ),

    Then<StudioJourney, number>(
      'the dialog offers to redo {int} locale',
      async (context, count) => {
        const submit = context.session.page
          .locator(DIALOG)
          .getByRole('button', {name: `Redo ${count} locale`})
        await settle(submit, `the "Redo ${count} locale" button`, context.session.page)
        expect(await submit.isEnabled()).toBe(true)
      },
    ),

    ...studioSteps,
  ],
})
