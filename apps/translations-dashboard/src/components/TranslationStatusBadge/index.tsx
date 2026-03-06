/**
 * Translation status badge for document list rows.
 *
 * Uses `getStatusDisplay()` from the shared package for workflow/in-flight
 * statuses and a local display map for document-lifecycle statuses
 * (published, draft, inRelease) that are specific to the dashboard.
 */

import type {StatusDisplay, TranslationStatus} from '@starter/l10n'

import {getStatusDisplay} from '@starter/l10n'
import {CheckmarkCircleIcon, CircleIcon, ClockIcon, EditIcon} from '@sanity/icons'
import {Badge, Flex, Text} from '@sanity/ui'
import {useRef} from 'react'

import {type LanguageData, useApp} from '../../contexts/AppContext'
import {useTranslationStatus} from '../../contexts/TranslationStatusContext'
import Loading from '../Loading'
import {StatusBadge} from '../StatusBadge'

/** Document-lifecycle statuses produced by the dashboard's TranslationStatusContext. */
type LifecycleStatus = 'draft' | 'inRelease' | 'missing' | 'missingWithFallback' | 'published'

const LIFECYCLE_DISPLAY_MAP: Record<LifecycleStatus, StatusDisplay> = {
  published: {
    icon: CheckmarkCircleIcon,
    tone: 'positive',
    label: 'Published',
    tooltip: 'Translation is published and live',
  },
  draft: {
    icon: EditIcon,
    tone: 'caution',
    label: 'Draft',
    tooltip: 'Translation exists as draft only',
  },
  inRelease: {
    icon: ClockIcon,
    tone: 'suggest',
    label: 'In Release',
    tooltip: 'Translation exists in a scheduled Sanity release',
  },
  missing: {
    icon: CircleIcon,
    tone: 'critical',
    label: 'Missing',
    tooltip: 'No translation exists for this locale',
  },
  missingWithFallback: {
    icon: CircleIcon,
    tone: 'caution',
    label: 'Missing',
    tooltip: 'No direct translation, but a fallback locale has one',
  },
}

function isLifecycleStatus(status: string): status is LifecycleStatus {
  return status in LIFECYCLE_DISPLAY_MAP
}

function getDisplay(status: string): StatusDisplay {
  if (isLifecycleStatus(status)) return LIFECYCLE_DISPLAY_MAP[status]
  return getStatusDisplay(status as TranslationStatus)
}

interface TranslationStatusBadgeProps {
  locale: LanguageData
  metadataId: string
}

export default function TranslationStatusBadge({locale, metadataId}: TranslationStatusBadgeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const {languages} = useApp()

  const fallbackLocaleId = locale.fallbackLocale
  const fallbackLocale = languages.find((l) => l.id === fallbackLocaleId)

  const {isLoading, status: statusData} = useTranslationStatus(metadataId, locale.id)

  if (isLoading || !statusData) {
    return <TranslationStatusBadgeSkeleton locale={locale} />
  }

  const {fallbackStatus, status} = statusData
  const resolvedStatus = resolveStatus(status, fallbackStatus, !!fallbackLocale)
  const display = getDisplay(resolvedStatus)
  const tooltip = buildTooltip(resolvedStatus, locale, fallbackLocale)

  return (
    <div ref={ref}>
      <StatusBadge icon={display.icon} text={locale.id} tone={display.tone} tooltip={tooltip} />
    </div>
  )
}

/**
 * Build a contextual tooltip that includes the locale name.
 */
function buildTooltip(status: string, locale: LanguageData, fallbackLocale?: LanguageData): string {
  switch (status) {
    case 'draft':
      return `This document has a draft translation to ${locale.title} (not yet published)`
    case 'inRelease':
      return `This document has a translation to ${locale.title} in a release`
    case 'missing':
      return `This document is missing a translation for ${locale.title}`
    case 'missingWithFallback':
      return `No translation for ${locale.title}, but fallback language ${fallbackLocale?.title ?? 'unknown'} is available`
    case 'published':
      return `This document has been translated to ${locale.title} (published)`
    default:
      return getDisplay(status).tooltip
  }
}

/**
 * Resolve the effective status from the context status data.
 *
 * The TranslationStatusContext returns `status` ('published' | 'draft' |
 * 'inRelease' | 'missing') and `fallbackStatus`. We distinguish
 * 'missing' from 'missingWithFallback' here.
 */
function resolveStatus(
  status: string,
  fallbackStatus: string | undefined,
  hasFallbackLocale: boolean,
): string {
  if (status === 'missing' && fallbackStatus && fallbackStatus !== 'missing' && hasFallbackLocale) {
    return 'missingWithFallback'
  }
  return status
}

export const TranslationStatusBadgeSkeleton = ({
  forwardedRef,
  locale,
}: {
  forwardedRef?: React.RefObject<HTMLDivElement>
  locale: LanguageData
}) => {
  return (
    <div ref={forwardedRef}>
      <Badge
        className="animate-pulse"
        style={{minWidth: '4rem', padding: '12px 8px'}}
        tone="default"
      >
        <Flex align="center" style={{gap: '11px'}}>
          <Loading />
          <Text size={1}>{locale.id}</Text>
        </Flex>
      </Badge>
    </div>
  )
}
