/**
 * Once per `pnpm e2e:browser`: prove the credentials and prove the dev servers
 * are up, so a missing `pnpm dev` fails here by name rather than as a browser
 * navigation timeout inside the first scenario.
 *
 * Unlike the API suite's setup this creates nothing and sweeps nothing: the
 * browser journeys read the dev dataset and never write to it — except the
 * review-verb scenarios, which mutate a run and only arm behind
 * `E2E_BROWSER_VERBS=1`.
 */

import {assertE2eCredentials} from '../fixtures/env'
import {DASHBOARD_ORIGIN, STUDIO_ORIGIN} from './session'

const PROBE_TIMEOUT_MS = 5_000

async function reachable(origin: string): Promise<boolean> {
  try {
    const response = await fetch(origin, {signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)})
    return response.ok
  } catch {
    return false
  }
}

export async function setup(): Promise<void> {
  assertE2eCredentials()

  const down = (
    await Promise.all(
      [STUDIO_ORIGIN, DASHBOARD_ORIGIN].map(async (origin) =>
        (await reachable(origin)) ? undefined : origin,
      ),
    )
  ).filter((origin) => origin !== undefined)

  if (down.length > 0) {
    throw new Error(
      `[e2e] dev server not reachable: ${down.join(', ')}.\n` +
        'The browser journeys drive the running dev servers — start them first:\n' +
        '  pnpm dev            # from the starter root, Studio :3333 + dashboard :3334\n' +
        'Override with SANITY_E2E_STUDIO_URL / SANITY_E2E_DASHBOARD_URL.',
    )
  }

  console.log(`[e2e] dev servers ready (${STUDIO_ORIGIN} + ${DASHBOARD_ORIGIN})`)
}
