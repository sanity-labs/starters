/**
 * @starter/l10n/handlers
 *
 * The runtime half of the localization workflows: one handler per effect the
 * definitions queue. Register the map on `createEngine({effectHandlers})`.
 *
 * React-free by construction — these run inside a Sanity Function.
 */

import type {EffectHandler} from '@sanity/workflow-engine'

import {ANALYZE_SOURCE, PUBLISH_RELEASE, TRANSLATE_LOCALE} from '../workflows/effects'
import {analyzeSource} from './analyzeSource'
import {publishRelease} from './publishRelease'
import {translateLocale} from './translateLocale'

/**
 * Keyed by the same constants the definitions declare. The engine matches an
 * effect to a handler by name alone, so a literal on either side would only
 * fail at drain time.
 */
export const localizationEffectHandlers: Record<string, EffectHandler> = {
  [ANALYZE_SOURCE]: analyzeSource,
  [TRANSLATE_LOCALE]: translateLocale,
  [PUBLISH_RELEASE]: publishRelease,
}

export {analyzeSource} from './analyzeSource'
export {publishRelease} from './publishRelease'
export {translateLocale} from './translateLocale'
export type {ContentClient, EffectContext} from './effectRuntime'
