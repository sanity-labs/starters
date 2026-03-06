/**
 * Pure function mapping translation status to visual display properties.
 *
 * This is the bridge between surfaces — both Surface 1 (SDK Dashboard) and
 * Surface 2 (Document Pane) use this to render consistent status indicators.
 *
 * Uses `@sanity/ui` Badge tones and `@sanity/icons` exclusively.
 * See `/spike-overview/design-language` for the full design spec.
 */

import {
  CheckmarkCircleIcon,
  CircleIcon,
  EditIcon,
  ErrorOutlineIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import type {BadgeTone} from '@sanity/ui'
import type {ComponentType, CSSProperties} from 'react'

import type {TranslationStatus} from '../core/types'

export interface StatusDisplay {
  /** Icon component from @sanity/icons */
  icon: ComponentType<{style?: CSSProperties}>
  /** @sanity/ui Badge tone */
  tone: BadgeTone
  /** Short label for badges and compact views */
  label: string
  /** Longer description for tooltips */
  tooltip: string
}

const STATUS_DISPLAY_MAP: Record<TranslationStatus, StatusDisplay> = {
  // Workflow states (persistent, stored in workflowStates on metadata)
  missing: {
    icon: CircleIcon,
    tone: 'critical',
    label: 'Missing',
    tooltip: 'No translation exists for this locale',
  },
  usingFallback: {
    icon: CircleIcon,
    tone: 'default',
    label: 'Fallback',
    tooltip: 'No direct translation, but covered by a fallback locale',
  },
  needsReview: {
    icon: EditIcon,
    tone: 'caution',
    label: 'Review',
    tooltip: 'AI translation created, pending review',
  },
  approved: {
    icon: CheckmarkCircleIcon,
    tone: 'positive',
    label: 'Approved',
    tooltip: 'Translation reviewed and approved',
  },
  stale: {
    icon: WarningOutlineIcon,
    tone: 'caution',
    label: 'Stale',
    tooltip: 'Source document has changed since this translation was created',
  },

  // In-flight states (transient, not persisted)
  translating: {
    icon: CircleIcon,
    tone: 'default',
    label: 'Translating…',
    tooltip: 'AI translation is in progress',
  },
  failed: {
    icon: ErrorOutlineIcon,
    tone: 'critical',
    label: 'Failed',
    tooltip: 'Translation failed — retry available',
  },
}

/**
 * Get the visual display properties for a translation status.
 *
 * @example
 * ```tsx
 * const display = getStatusDisplay('approved')
 * // { icon: CheckmarkCircleIcon, tone: 'positive', label: 'Approved', tooltip: '...' }
 *
 * <Badge tone={display.tone}>
 *   <display.icon />
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
