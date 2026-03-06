import type {Locale} from '../../helpers/getLocales'

import {Badge, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {motion} from 'framer-motion'

import {ClickableTranslationItem} from './ClickableTranslationItem'
import {CompletedTranslationItem} from './CompletedTranslationItem'
import {DestinationInfo} from './DestinationInfo'
import TranslationProgressBar from './TranslationProgressBar'

export type OtherPerspectiveInfo = {
  draft?: {_id: string; title: null | string} | null
  published?: {_id: string; title: null | string} | null
  versions?: Array<{_id: string; releaseId: string; title: null | string}>
}

type TranslationLanguageItemProps = {
  disabled?: boolean
  documentType: string
  error?: string
  fallbackExists?: boolean
  fallbackLanguage?: Locale
  isSelected?: boolean
  languageId: string
  languageTitle: string
  locale: Locale
  onRetry?: () => void
  onTranslate?: () => void
  otherPerspectives?: OtherPerspectiveInfo
  progress?: number
  releaseMap: Map<string, string>
  releaseName?: string
  selectedRelease: null | string
  status: 'completed' | 'completing' | 'failed' | 'missing' | 'translating'
  translatedDocumentId?: string
  translatedDocumentTitle?: null | string
  workflowStatus?: 'approved' | 'missing' | 'needsReview' | 'stale' | 'usingFallback'
}

const TranslationLanguageItem = ({
  disabled = false,
  documentType,
  error,
  fallbackExists = false,
  fallbackLanguage,
  languageId,
  locale,
  onRetry,
  onTranslate,
  otherPerspectives,
  progress = 0,
  releaseMap,
  releaseName,
  selectedRelease,
  status,
  translatedDocumentId,
  translatedDocumentTitle,
  workflowStatus,
}: TranslationLanguageItemProps) => {
  const effectiveRelease = locale.releaseId || selectedRelease
  const isLockedToRelease = !!locale.releaseId
  const effectiveReleaseName = effectiveRelease
    ? releaseMap.get(effectiveRelease) || effectiveRelease
    : null

  const getOtherPerspectiveLabel = (): null | string => {
    if (!otherPerspectives) return null

    if (selectedRelease) {
      if (otherPerspectives.draft) return 'Exists as draft'
      if (otherPerspectives.published) return 'Exists as published'
      const otherReleases = otherPerspectives.versions?.filter(
        (v) => v.releaseId !== selectedRelease,
      )
      if (otherReleases && otherReleases.length > 0) {
        const name = releaseMap.get(otherReleases[0].releaseId) || otherReleases[0].releaseId
        return `In release: ${name}`
      }
    } else {
      if (otherPerspectives.versions && otherPerspectives.versions.length > 0) {
        const name =
          releaseMap.get(otherPerspectives.versions[0].releaseId) ||
          otherPerspectives.versions[0].releaseId
        return `In release: ${name}`
      }
    }
    return null
  }

  const otherPerspectiveLabel = getOtherPerspectiveLabel()

  // Missing + fallback available
  if (status === 'missing' && fallbackExists && fallbackLanguage) {
    return (
      <ClickableTranslationItem
        badgeBgColor="bg-yellow-600"
        borderClassName="border-2 border-yellow-500 bg-yellow-50 hover:bg-yellow-100"
        disabled={disabled}
        languageId={languageId}
        onClick={onTranslate}
        rightContent={
          <Flex align="center" gap={2}>
            {otherPerspectiveLabel && (
              <Badge fontSize={0} padding={2} radius={3} tone="primary">
                <Text size={1}>{otherPerspectiveLabel}</Text>
              </Badge>
            )}
            <DestinationInfo
              effectiveReleaseName={effectiveReleaseName}
              isLockedToRelease={isLockedToRelease}
            />
          </Flex>
        }
      >
        <Text className="italic" size={1} weight="semibold">
          Using fallback ({fallbackLanguage.title})
        </Text>
      </ClickableTranslationItem>
    )
  }

  // Missing + exists in another perspective
  if (status === 'missing' && otherPerspectiveLabel) {
    return (
      <ClickableTranslationItem
        badgeBgColor="bg-purple-600"
        borderClassName="border-2 border-purple-400 bg-purple-50 hover:bg-purple-100"
        disabled={disabled}
        languageId={languageId}
        onClick={onTranslate}
        rightContent={
          <Flex align="center" gap={2}>
            <Badge fontSize={0} padding={2} radius={3} tone="primary">
              <Text size={1}>{otherPerspectiveLabel}</Text>
            </Badge>
            <DestinationInfo
              effectiveReleaseName={effectiveReleaseName}
              isLockedToRelease={isLockedToRelease}
            />
          </Flex>
        }
      >
        <Text className="italic" size={1} weight="semibold">
          Not in this perspective
        </Text>
      </ClickableTranslationItem>
    )
  }

  // Missing
  if (status === 'missing') {
    return (
      <ClickableTranslationItem
        badgeBgColor="bg-red-500"
        borderClassName="border-2 border-dashed border-red-300 bg-red-50 hover:bg-red-100"
        disabled={disabled}
        languageId={languageId}
        onClick={onTranslate}
        rightContent={
          <DestinationInfo
            effectiveReleaseName={effectiveReleaseName}
            isLockedToRelease={isLockedToRelease}
          />
        }
      >
        <Text className="italic" size={1} weight="semibold">
          Translation missing
        </Text>
      </ClickableTranslationItem>
    )
  }

  if (status === 'translating') {
    return <TranslationProgressBar languageId={languageId} progress={progress} />
  }

  // Completing — temporary success before transitioning to completed
  if (status === 'completing') {
    const bgColor = '#E8DEFF'
    const borderColor = '#7C5CDB'
    const textColor = '#5E41A4'

    return (
      <motion.div
        animate={{opacity: 1, scale: 1}}
        initial={{opacity: 0, scale: 0.98}}
        transition={{duration: 0.3, ease: 'easeOut'}}
      >
        <Card
          className="border-2 min-h-[3.25rem]"
          radius={3}
          style={{backgroundColor: bgColor, borderColor}}
        >
          <Stack padding={3} space={2}>
            <Flex align="center" gap={2} justify="space-between" wrap="wrap">
              <Flex align="center" className="flex-1 min-w-0" gap={2}>
                <div
                  className="cursor-pointer transition-all duration-200 px-2 py-1 text-white text-xs rounded-full w-14 flex-shrink-0 text-center"
                  style={{backgroundColor: borderColor}}
                >
                  {languageId}
                </div>
                <div className="min-w-0" style={{color: textColor}}>
                  <Text size={1} weight="semibold">
                    Translation complete — Now in {releaseName || 'release'}
                  </Text>
                </div>
              </Flex>
            </Flex>
          </Stack>
        </Card>
      </motion.div>
    )
  }

  // Failed
  if (status === 'failed') {
    return (
      <Card
        border
        className="border-2 border-red-500 bg-red-50 min-h-[3.25rem]"
        padding={3}
        radius={2}
      >
        <Stack space={2}>
          <Flex align="center" gap={2} justify="space-between" wrap="wrap">
            <Badge className="flex-shrink-0" fontSize={1} padding={2} radius={4} tone="critical">
              {languageId}
            </Badge>
            <Text muted size={0}>
              Translation failed
            </Text>
          </Flex>
          {error && (
            <Text muted size={0}>
              {error}
            </Text>
          )}
          <Button mode="ghost" onClick={onRetry} size={1} text="Retry" tone="critical" />
        </Stack>
      </Card>
    )
  }

  // Completed — colors vary by document state
  if (status === 'completed' && translatedDocumentId) {
    return (
      <CompletedTranslationItem
        documentType={documentType}
        languageId={languageId}
        releaseMap={releaseMap}
        translatedDocumentId={translatedDocumentId}
        translatedDocumentTitle={translatedDocumentTitle}
        workflowStatus={workflowStatus}
      />
    )
  }

  return null
}

export const TranslationLanguageItemSkeleton = ({languageId}: {languageId: string}) => {
  return (
    <Card
      className="border-2 min-h-[3.25rem] animate-pulse"
      radius={3}
      style={{backgroundColor: '#f3f4f6', borderColor: '#e5e7eb'}}
    >
      <Flex align="center" gap={2} padding={3}>
        <div
          className="px-2 py-1 text-white text-xs rounded-full w-14 flex-shrink-0 text-center"
          style={{backgroundColor: '#9ca3af'}}
        >
          {languageId}
        </div>
        <div className="flex-1">
          <div className="h-4 bg-gray-300 rounded w-32" />
        </div>
      </Flex>
    </Card>
  )
}

export default TranslationLanguageItem
