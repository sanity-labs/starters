/**
 * B2 — the Localization inbox: the structure group an editor starts their day
 * in, and the counts it promises.
 */

import type {Locator, Page} from 'playwright'
import type {StudioJourney} from './context'

import {After, Before, Then} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, expect} from 'vitest'

import {resetContext} from '../fixtures/context'
import {gateFeature, type GateReason} from './gate'
import {openSession, settle, STUDIO_ORIGIN} from './session'
import {contextAndAction, studioSteps} from './steps'
import {documentPanes} from './studio'
import featureText from './studio-inbox.feature?raw'

/** The four questions `runSections.ts` buckets an open run into. */
const SECTIONS = ['Needs review', 'Translating', 'Source changed', 'Failed locales'] as const

/** What `RunSectionPane` renders in place of rows. */
const EMPTY_SECTION = 'Nothing waiting here.'

const session = await openSession(STUDIO_ORIGIN, 'studio-inbox')

/** A section's list row. The count is baked into the title, so match a prefix. */
function sectionItem(page: Page, section: string): Locator {
  return page.getByTestId(new RegExp(`^pane-item-${section} \\(`))
}

/** The run count a section's own title promises. */
async function promisedCount(page: Page, section: string): Promise<number> {
  const testId = await sectionItem(page, section).first().getAttribute('data-testid')
  const match = /\((\d+)\)$/.exec(testId ?? '')
  if (!match) throw new Error(`[e2e] no count in the "${section}" section title (${testId})`)
  return Number(match[1])
}

/** The rightmost pane — after entering a section, that is the section's own. */
function lastPane(page: Page): Locator {
  return page.locator('[data-ui="Pane"]').last()
}

async function openInbox(page: Page): Promise<void> {
  await settle(page.getByTestId('pane-item-Localization'), 'the Localization group', page)
  await page.getByTestId('pane-item-Localization').click()
  await settle(sectionItem(page, SECTIONS[0]).first(), `the "${SECTIONS[0]}" section`, page)
}

/**
 * The row-opening scenario needs a run to open. There is no cheap way to make
 * one: publishing an edit hands the deployed `start-localization` Function a
 * real subject, which fans out to every configured locale with real Agent
 * Actions. So the journey asserts against whatever the dev dataset holds, and
 * says out loud when that is nothing.
 */
async function probeOpenRun(): Promise<GateReason> {
  const {page} = session
  await session.goto('/structure')
  await openInbox(page)

  const counts = await Promise.all(SECTIONS.map((section) => promisedCount(page, section)))
  if (counts.some((count) => count > 0)) return undefined

  return (
    'every inbox section counts 0 — the dev dataset has no open localization run, ' +
    'and opening one means a real fan-out through the deployed Functions. ' +
    'Start a run (publish a source edit, or the dashboard) and re-run.'
  )
}

const noOpenRun = await probeOpenRun()

let scenario = 0

afterAll(() => session.close())

Feature<StudioJourney>({
  featureText: gateFeature(featureText, '@requires-open-run', noOpenRun),
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
    ...contextAndAction<undefined>('the Studio structure is open', async (context) => {
      await context.session.goto('/structure')
      await settle(
        context.session.page.getByTestId('pane-item-Localization'),
        'the structure root pane',
        context.session.page,
      )
    }),

    ...contextAndAction<undefined>('the editor opens the Localization group', async (context) => {
      await openInbox(context.session.page)
    }),

    Then<StudioJourney, string>('the inbox has a {string} section', async (context, section) => {
      await settle(
        sectionItem(context.session.page, section).first(),
        `the "${section}" section`,
        context.session.page,
      )
    }),

    ...contextAndAction<string>(
      'the editor enters the {string} section',
      async (context, section) => {
        const {page} = context.session
        context.sectionCount = await promisedCount(page, section)
        await sectionItem(page, section).first().click()
        await settle(
          lastPane(page).getByText(section, {exact: true}),
          `the "${section}" pane`,
          page,
        )
      },
    ),

    ...contextAndAction<undefined>(
      'the editor enters the first section holding a run',
      async (context) => {
        const {page} = context.session
        for (const section of SECTIONS) {
          const count = await promisedCount(page, section)
          if (count === 0) continue
          context.sectionCount = count
          await sectionItem(page, section).first().click()
          await settle(
            lastPane(page).getByText(section, {exact: true}),
            `the "${section}" pane`,
            page,
          )
          return
        }
        throw new Error('[e2e] no inbox section holds a run — the gate should have skipped this')
      },
    ),

    /**
     * The count comes from the engine's instance list and the rows from the
     * subjects those instances name — two reads that a stale reader model can
     * disagree on. At zero the pane owes an empty state instead, which is the
     * same contract stated for the empty case.
     */
    Then<StudioJourney>('the section lists as many runs as its title counted', async (context) => {
      const {page} = context.session
      const rows = lastPane(page).locator('[data-ui="PreviewCard"]')

      if (context.sectionCount === 0) {
        await settle(lastPane(page).getByText(EMPTY_SECTION), 'the empty-section notice', page)
      } else {
        await settle(rows.first(), 'the first run row', page)
      }
      expect(await rows.count()).toBe(context.sectionCount)
    }),

    ...contextAndAction<undefined>(
      'the editor opens the first run in the section',
      async (context) => {
        const {page} = context.session
        context.panesBefore = await documentPanes(page).count()
        await lastPane(page).locator('[data-ui="PreviewCard"]').first().click()
      },
    ),

    Then<StudioJourney>('a document pane is open', async (context) => {
      const {page} = context.session
      await settle(documentPanes(page).nth(context.panesBefore), 'the run’s document pane', page)
    }),

    ...studioSteps,
  ],
})
