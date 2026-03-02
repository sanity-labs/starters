/**
 * Translation status badge for document list rows.
 *
 * Uses `getStatusDisplay()` from the shared package as the single source
 * of truth for icon, tone, and label — ensuring visual consistency with
 * the summary bar, charts, and Surface 2 document pane.
 *
 * Contextual tooltips include the locale name for clarity.
 */

import type {TranslationStatus} from '@starter/l10n'

import {getStatusDisplay} from '@starter/l10n'
import {Badge, Flex, Text} from '@sanity/ui'
import {useRef} from 'react'

import {type LanguageData, useApp} from '../../contexts/AppContext'
import {useTranslationStatus} from '../../contexts/TranslationStatusContext'
import Loading from '../Loading'
import {StatusBadge} from '../StatusBadge'

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
  const display = getStatusDisplay(resolvedStatus)
  const tooltip = buildTooltip(resolvedStatus, locale, fallbackLocale)

  return (
    <div ref={ref}>
      <StatusBadge icon={display.icon} text={locale.id} tone={display.tone} tooltip={tooltip} />
    </div>
  )
}

/**
 * Build a contextual tooltip that includes the locale name.
 * Enriches the generic tooltip from getStatusDisplay() with locale context.
 */
function buildTooltip(
  status: TranslationStatus,
  locale: LanguageData,
  fallbackLocale?: LanguageData,
): string {
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
      return getStatusDisplay(status).tooltip
  }
}

/**
 * Resolve the effective TranslationStatus from the context status data.
 *
 * The TranslationStatusContext returns `status` ('published' | 'draft' |
 * 'inRelease' | 'missing') and `fallbackStatus`. We need to distinguish
 * 'missing' from 'missingWithFallback' for the shared getStatusDisplay().
 */
function resolveStatus(
  status: string,
  fallbackStatus: string | undefined,
  hasFallbackLocale: boolean,
): TranslationStatus {
  if (status === 'missing' && fallbackStatus && fallbackStatus !== 'missing' && hasFallbackLocale) {
    return 'missingWithFallback'
  }
  // The context status values ('published', 'draft', 'inRelease', 'missing')
  // are all valid TranslationStatus keys
  return status as TranslationStatus
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
