/**
 * A Chromium tab, already logged in, pointed at one of the dev servers.
 *
 * Playwright is used as a library rather than through `@playwright/test`: the
 * suite's runner is vitest, because that is the driver racejar actually works
 * with (see "Browser journeys" in `../README.md`). So there is no fixture
 * injection here — a feature file opens a session in `beforeAll` and closes it
 * in `afterAll`, the same shape as the API journeys' `createHarness`.
 */

import type {Browser, ConsoleMessage, Locator, Page} from 'playwright'

import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'

import {assertE2eCredentials} from '../fixtures/env'

/** Where the dev servers live. `pnpm dev` from the starter root starts both. */
export const STUDIO_ORIGIN = process.env.SANITY_E2E_STUDIO_URL ?? 'http://localhost:3333'
export const DASHBOARD_ORIGIN = process.env.SANITY_E2E_DASHBOARD_URL ?? 'http://localhost:3334'

/** One directory per suite run; a failed assertion is diagnosed from these. */
const SHOTS_DIR = process.env.L10N_SHOTS_DIR ?? '/tmp/l10n-shots/e2e-browser'

/** A first paint of the Studio compiles the whole config through Vite. */
const BOOT_TIMEOUT_MS = 90_000

/** How long a locator that should already be settled is waited on. */
export const SETTLE_TIMEOUT_MS = 30_000

export interface Session {
  readonly page: Page
  readonly origin: string
  /** Navigate to a path on this session's origin and wait for the DOM. */
  goto(path: string): Promise<void>
  /** Write a screenshot into the run's shots directory. */
  shot(name: string): Promise<void>
  close(): Promise<void>
}

/**
 * Sanity Studio reads its token from `localStorage`, so an init script is the
 * whole of "log in" — no OAuth round trip, no stored auth state file.
 * `getAuthTokenStorageKey` in `sanity` is where the key comes from.
 */
function authTokenEntry(projectId: string, token: string): [string, string] {
  return [`__studio_auth_token_${projectId}`, JSON.stringify({token})]
}

export async function openSession(origin: string, label: string): Promise<Session> {
  const {projectId, token} = assertE2eCredentials()

  const browser: Browser = await chromium.launch()
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}})
  await context.addInitScript(
    ([key, value]: [string, string]) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {}
    },
    authTokenEntry(projectId, token),
  )

  const page = await context.newPage()
  page.setDefaultTimeout(SETTLE_TIMEOUT_MS)
  page.on('pageerror', (error: Error) => console.log(`[e2e:${label}] page error: ${error.message}`))
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') console.log(`[e2e:${label}] console: ${message.text()}`)
  })

  await mkdir(SHOTS_DIR, {recursive: true})

  return {
    page,
    origin,

    async goto(path) {
      await page.goto(`${origin}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: BOOT_TIMEOUT_MS,
      })
    },

    async shot(name) {
      await page.screenshot({path: `${SHOTS_DIR}/${label}-${name}.png`})
    },

    async close() {
      await browser.close()
    },
  }
}

/**
 * Resolve a locator, or report what was on screen instead.
 *
 * Playwright's own `expect` lives in `@playwright/test`, which this layer does
 * not use, so waiting and asserting are separate: `.waitFor()` is the wait and
 * vitest's `expect` takes the resolved value. A bare timeout says only which
 * selector missed, which is not enough to tell a broken selector from a broken
 * screen.
 */
export async function settle(locator: Locator, what: string, page: Page): Promise<void> {
  try {
    await locator.waitFor({state: 'visible', timeout: SETTLE_TIMEOUT_MS})
  } catch (error) {
    const body = await page.locator('body').innerText()
    throw new Error(
      `[e2e] ${what} never appeared.\n--- what was on screen ---\n${body.slice(0, 1200)}`,
      {cause: error},
    )
  }
}
