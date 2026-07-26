/**
 * What the dev dataset holds, read the same way the Studio reads it.
 *
 * The browser journeys assert against the dataset the dev servers are pointed
 * at — `SANITY_STUDIO_DATASET`, not the API suite's throwaway pair — because
 * they drive the running Studio and cannot be told to look elsewhere. Every
 * read here is a read: nothing in this layer writes.
 */

import type {SanityClient} from '@sanity/client'
import type {GateReason} from './gate'

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

/** A configured locale, as its `l10n.locale` document names it. */
export interface NamedLocale {
  code: string
  title: string
}

/** Every configured locale. The matrix labels rows by code and names them by title. */
export async function namedLocales(): Promise<NamedLocale[]> {
  return devClient().fetch<NamedLocale[]>(`*[_type == $type]{code, title}`, {
    type: localeTypeName,
  })
}

/**
 * The locales the matrix is expected to list: every configured `l10n.locale`
 * except the source. Read rather than hard-coded, so adding a locale to the
 * dataset does not turn a journey red.
 */
export async function targetLocales(): Promise<string[]> {
  const locales = await namedLocales()
  return locales
    .map((locale) => locale.code)
    .filter((code) => code !== SOURCE_LANGUAGE)
    .sort()
}

/**
 * Is the document a journey drives in the dev dataset at all?
 *
 * The journeys open sample documents by id. On a dataset that never imported
 * them, every locator in the feature misses and the run reports a settle
 * timeout against the first one — which says nothing about the actual cause.
 * One read up front turns that into a skip that names the document.
 */
export async function missingSampleDocument(id: string): Promise<GateReason> {
  const found = await devClient().fetch<boolean>(`defined(*[_id in [$id, "drafts." + $id]][0])`, {
    id,
  })
  if (found) return undefined

  return (
    `${DEV_DATASET} holds no document "${id}" — \`pnpm bootstrap\` seeds the locales ` +
    'and imports studio/sample-data.ndjson'
  )
}
