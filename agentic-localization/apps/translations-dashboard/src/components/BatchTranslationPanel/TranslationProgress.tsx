import {LockIcon} from '@sanity/icons'
import {Badge, Box, Card, Flex, Spinner, Stack, Text, Tooltip} from '@sanity/ui'

import type {
  DocumentTranslationProgress,
  Language,
  LanguageTranslationStatus,
  Translation,
} from './types'

type TranslationProgressProps = {
  documentLanguage: null | string
  existingTranslations?: Translation[]
  languages: Language[]
  progress: DocumentTranslationProgress
  releaseMap?: Map<string, string>
  selectedRelease?: null | string
  translationsByLanguage?: Record<string, LanguageTranslationStatus>
}

const TranslationProgress = ({
  documentLanguage,
  existingTranslations = [],
  languages,
  progress,
  releaseMap,
  selectedRelease,
  translationsByLanguage,
}: TranslationProgressProps) => {
  // Get all languages except the document's base language
  const targetLanguages = languages.filter((lang) => lang.id !== documentLanguage)

  // If we have no target languages to show, return null
  if (targetLanguages.length === 0) return null

  // Build the status for each language
  const languageStatuses = targetLanguages.map((lang) => {
    // First check if we have active progress for this language (during translation)
    // Only use progress if it's actively creating, created, or failed (not pending)
    const progressItem = progress?.translations.find((t) => t.languageId === lang.id)
    const hasActiveProgress =
      progressItem && ['created', 'creating', 'failed'].includes(progressItem.status)

    if (hasActiveProgress && progressItem) {
      // Use progress status (creating, created, failed)
      return {
        dotColor:
          progressItem.status === 'created'
            ? 'bg-green-500'
            : progressItem.status === 'creating'
              ? 'bg-yellow-500'
              : 'bg-red-500',
        languageId: lang.id,
        languageTitle: lang.title,
        releaseName: progressItem.releaseName,
        showCheckmark: progressItem.status === 'created',
        showLock: !!lang.releaseId,
        showSpinner: progressItem.status === 'creating',
        status: progressItem.status,
        tone:
          progressItem.status === 'created'
            ? ('positive' as const)
            : progressItem.status === 'creating'
              ? ('caution' as const)
              : ('critical' as const),
      }
    }

    // Otherwise, use the computed translation status
    const translationStatus = translationsByLanguage?.[lang.id]
    if (translationStatus) {
      if (translationStatus.status === 'completed') {
        return {
          dotColor: 'bg-green-500',
          languageId: lang.id,
          languageTitle: lang.title,
          releaseName: translationStatus.releaseName,
          showCheckmark: true,
          showLock: translationStatus.isLocked,
          showSpinner: false,
          status: 'completed' as const,
          tone: 'positive' as const,
        }
      } else if (translationStatus.status === 'fallback') {
        return {
          dotColor: 'bg-yellow-500',
          languageId: lang.id,
          languageTitle: lang.title,
          releaseName: translationStatus.releaseName,
          showCheckmark: false,
          showLock: translationStatus.isLocked,
          showSpinner: false,
          status: 'fallback' as const,
          tone: 'caution' as const,
        }
      } else {
        // missing
        return {
          dotColor: 'bg-red-500',
          languageId: lang.id,
          languageTitle: lang.title,
          releaseName: translationStatus.releaseName,
          showCheckmark: false,
          showLock: translationStatus.isLocked,
          showSpinner: false,
          status: 'missing' as const,
          tone: 'critical' as const,
        }
      }
    }

    // Default fallback (shouldn't happen, but just in case)
    return {
      dotColor: 'bg-gray-400',
      languageId: lang.id,
      languageTitle: lang.title,
      releaseName: undefined,
      showCheckmark: false,
      showLock: false,
      showSpinner: false,
      status: 'pending' as const,
      tone: 'default' as const,
    }
  })

  return (
    <Box className="border-l-2 border-gray-200 ml-2" paddingLeft={3}>
      <Stack space={2}>
        {languageStatuses.map((langStatus) => (
          <Card
            border
            className="border"
            key={langStatus.languageId}
            padding={2}
            radius={2}
            tone="transparent"
          >
            <Flex align="center" gap={2} justify="space-between">
              <Flex align="center" className="flex-1 min-w-0" gap={2}>
                <Box className={`w-2 h-2 rounded-full shrink-0 ${langStatus.dotColor}`} />
                <Stack className="flex-1 min-w-0" space={1}>
                  <Flex align="center" gap={2}>
                    <Text size={1} weight="medium">
                      {langStatus.languageTitle}
                    </Text>
                    <Badge fontSize={0} padding={1} radius={1} tone={langStatus.tone}>
                      {langStatus.languageId}
                    </Badge>
                  </Flex>
                  <Flex align="center" gap={1}>
                    {langStatus.status === 'completed' && (
                      <Text muted size={0}>
                        ✓ Translated
                      </Text>
                    )}
                    {langStatus.status === 'missing' && (
                      <Text muted size={0}>
                        ✗ Not translated
                      </Text>
                    )}
                    {langStatus.status === 'fallback' && (
                      <Text muted size={0}>
                        ⚠ Using fallback
                      </Text>
                    )}
                    {langStatus.status === 'pending' && (
                      <Text muted size={0}>
                        ⋯ Pending
                      </Text>
                    )}
                    {(langStatus.status === 'creating' || langStatus.showSpinner) && (
                      <>
                        <Spinner size={0} />
                        <Text muted size={0}>
                          Creating...
                        </Text>
                      </>
                    )}
                    {langStatus.status === 'created' && langStatus.showCheckmark && (
                      <Text muted size={0}>
                        ✓ Created
                      </Text>
                    )}
                    {langStatus.status === 'failed' && (
                      <Text muted size={0}>
                        ✗ Failed
                      </Text>
                    )}
                  </Flex>
                </Stack>
              </Flex>
              <Flex align="center" className="shrink-0" gap={1}>
                {langStatus.releaseName && (
                  <Tooltip
                    content={
                      <Box padding={1}>
                        <Text size={0}>
                          {langStatus.showLock
                            ? `Locked to release: ${langStatus.releaseName}`
                            : `Will go into: ${langStatus.releaseName}`}
                        </Text>
                      </Box>
                    }
                  >
                    <Badge fontSize={0} padding={2} radius={2} tone="primary">
                      <Flex align="center" gap={1}>
                        {langStatus.showLock && <LockIcon className="text-[0.75rem]" />}
                        <Text size={0} weight="medium">
                          {langStatus.releaseName}
                        </Text>
                      </Flex>
                    </Badge>
                  </Tooltip>
                )}
              </Flex>
            </Flex>
          </Card>
        ))}
        {progress?.currentlyTranslating && (
          <Text className="pl-3 italic" muted size={0}>
            Creating {progress.currentlyTranslating}...
          </Text>
        )}
      </Stack>
    </Box>
  )
}

export default TranslationProgress
