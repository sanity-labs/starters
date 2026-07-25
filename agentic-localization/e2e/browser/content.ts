/**
 * What the dev dataset holds, read the same way the Studio reads it.
 *
 * The browser journeys assert against the dataset the dev servers are pointed
 * at — `SANITY_STUDIO_DATASET`, not the API suite's throwaway pair — because
 * they drive the running Studio and cannot be told to look elsewhere. Every
 * read here is a read: nothing in this layer writes.
 */

import type {SanityClient} from '@sanity/client'

import {createClient} from '@sanity/client'
import {localeTypeName} from '@starter/l10n'
import {SOURCE_LANGUAGE} from '@starter/l10n/workflows'

import {API_VERSION, assertE2eCredentials} from '../fixtures/env'

/** The dataset the dev Studio is serving. */
export const DEV_DATASET = process.env.SANITY_STUDIO_DATASET ?? 'production'

export function devClient(): SanityClient {
  const {projectId, token} = assertE2eCredentials()
  return createClient({
    projectId,
    dataset: DEV_DATASET,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
    requestTagPrefix: 'e2e.browser',
  })
}

/**
 * The locales the matrix is expected to list: every configured `l10n.locale`
 * except the source. Read rather than hard-coded, so adding a locale to the
 * dataset does not turn a journey red.
 */
export async function targetLocales(): Promise<string[]> {
  const codes = await devClient().fetch<string[]>(`*[_type == $type].code`, {
    type: localeTypeName,
  })
  return codes.filter((code) => code !== SOURCE_LANGUAGE).sort()
}
