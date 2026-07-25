/**
 * Binds the icon names `getStatusDisplay` returns to `@sanity/icons` components.
 *
 * `@starter/l10n` names an icon rather than shipping one, so the package stays
 * free of React and `@sanity/icons`. The binding is per-surface, and this is the
 * dashboard's. `Record` over the closed name union means adding a name upstream
 * is a type error here rather than a blank space at runtime.
 */

import type {StatusIconName} from '@starter/l10n'
import type {ComponentType, CSSProperties} from 'react'

import {
  AddCircleIcon,
  CheckmarkCircleIcon,
  CircleIcon,
  EditIcon,
  ErrorOutlineIcon,
  SyncIcon,
} from '@sanity/icons'

export const STATUS_ICONS: Record<StatusIconName, ComponentType<{style?: CSSProperties}>> = {
  'add-circle': AddCircleIcon,
  'checkmark-circle': CheckmarkCircleIcon,
  circle: CircleIcon,
  edit: EditIcon,
  'error-outline': ErrorOutlineIcon,
  sync: SyncIcon,
}
