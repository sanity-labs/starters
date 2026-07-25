/**
 * `@starter/l10n/effects`
 *
 * The runtime half of the localization workflows: one handler per effect the
 * definitions queue. Register the map on `createEngine({effectHandlers})`.
 *
 * This entry is also the documented extension surface. A custom workflow built
 * on `@starter/l10n/workflows` reuses these handlers as-is, wraps one, or writes
 * its own on the same `effectRuntime` plumbing — client routing, param
 * narrowing, GDR arithmetic and the at-least-once idempotency read are the parts
 * that are tedious and easy to get wrong, so they are exported deliberately
 * rather than kept private.
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

export {
  AGENT_API_VERSION,
  agentClient,
  contentClientFor,
  datasetOf,
  effectAlreadyDone,
  instancePerspective,
  isGdrUri,
  optionalRelease,
  optionalString,
  readSubjectDocument,
  requestTagSegment,
  requireGdr,
  requireString,
  siblingGdr,
  type ContentClient,
  type EffectContext,
} from './effectRuntime'
