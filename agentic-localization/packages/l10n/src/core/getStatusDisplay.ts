/**
 * This is the bridge between surfaces — both the SDK dashboard and the Studio
 * document pane render status from the same table, so a "stale" badge means the
 * same thing in both.
 *
 * It names an icon rather than returning one. Binding a name to a component is
 * the renderer's job: keeping this module free of `react`, `@sanity/icons` and
 * `@sanity/ui` — even in type position — is what lets it sit on the node floor
 * alongside the rest of the core primitives.
 */

import type {TranslationStatus} from './types'

/**
 * The icons a status can name. Each maps to a `@sanity/icons` component at the
 * rendering surface; the set is closed so a renderer's table is exhaustive.
 */
export type StatusIconName =
  | 'add-circle'
  | 'checkmark-circle'
  | 'circle'
  | 'edit'
  | 'error-outline'
  | 'sync'

/**
 * Declared locally rather than imported from `@sanity/ui`. The values are a
 * subset of `BadgeTone`, so they still assign straight into a `<Badge tone>`.
 */
export type StatusTone = 'caution' | 'critical' | 'default' | 'positive' | 'suggest'

export interface StatusDisplay {
  icon: StatusIconName
  tone: StatusTone
  label: string
  tooltip: string
}

const STATUS_DISPLAY_MAP: Record<TranslationStatus, StatusDisplay> = {
  // Persisted per-locale states
  missing: {
    icon: 'add-circle',
    tone: 'critical',
    label: 'Missing',
    tooltip: 'No translation exists for this locale',
  },
  usingFallback: {
    icon: 'circle',
    tone: 'default',
    label: 'Fallback',
    tooltip: 'No direct translation, but covered by a fallback locale',
  },
  needsReview: {
    icon: 'edit',
    tone: 'caution',
    label: 'Review',
    tooltip: 'AI translation created, pending review',
  },
  approved: {
    icon: 'checkmark-circle',
    tone: 'positive',
    label: 'Approved',
    tooltip: 'Translation reviewed and approved',
  },
  stale: {
    icon: 'sync',
    tone: 'suggest',
    label: 'Stale',
    tooltip: 'Source document has changed since this translation was created',
  },

  // In-flight states (transient, not persisted)
  translating: {
    icon: 'circle',
    tone: 'default',
    label: 'Translating…',
    tooltip: 'AI translation is in progress',
  },
  failed: {
    icon: 'error-outline',
    tone: 'critical',
    label: 'Failed',
    tooltip: 'Translation failed — retry available',
  },
}

/**
 * @example
 * ```tsx
 * const display = getStatusDisplay('approved')
 * // { icon: 'checkmark-circle', tone: 'positive', label: 'Approved', tooltip: '...' }
 *
 * const Icon = STATUS_ICONS[display.icon]
 * <Badge tone={display.tone}>
 *   <Icon />
 *   {display.label}
 * </Badge>
 * ```
 */
export function getStatusDisplay(status: TranslationStatus): StatusDisplay {
  const display = STATUS_DISPLAY_MAP[status]
  if (!display) {
    throw new Error(`Unknown translation status: "${status}"`)
  }
  return display
}
