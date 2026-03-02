import type {DocumentHandle} from '@sanity/sdk-react'

import {Badge, Box, Card, Flex, Stack, Text, Tooltip} from '@sanity/ui'

import OpenInStudioButton from '../OpenInStudioButton'
import {TranslationDocumentWrapper} from './TranslationDocument'

const WORKFLOW_BADGE_CONFIG: Record<
  string,
  {label: string; tone: 'caution' | 'critical' | 'default' | 'positive'}
> = {
  approved: {label: 'Approved', tone: 'positive'},
  missing: {label: 'Needs Translation', tone: 'critical'},
  needsReview: {label: 'Needs Review', tone: 'caution'},
  stale: {label: 'Stale', tone: 'caution'},
  usingFallback: {label: 'Using Fallback', tone: 'default'},
}

interface CompletedTranslationItemProps {
  documentType: string
  languageId: string
  releaseMap: Map<string, string>
  translatedDocumentId: string
  translatedDocumentTitle?: null | string
  workflowStatus?: 'approved' | 'missing' | 'needsReview' | 'stale' | 'usingFallback'
}

export function CompletedTranslationItem({
  documentType,
  languageId,
  releaseMap,
  translatedDocumentId,
  translatedDocumentTitle,
  workflowStatus,
}: CompletedTranslationItemProps) {
  const isVersion = translatedDocumentId.startsWith('versions.')
  const isDraft = translatedDocumentId.startsWith('drafts.')
  const releaseId = isVersion ? translatedDocumentId.split('.')[1] : null
  const releaseName = releaseId ? releaseMap.get(releaseId) || releaseId : null

  let documentId = translatedDocumentId
  if (isVersion) {
    documentId = translatedDocumentId.split('.').slice(2).join('.')
  } else if (isDraft) {
    documentId = translatedDocumentId.slice(7)
  }

  const documentHandle: DocumentHandle = {
    dataset: import.meta.env.SANITY_APP_DATASET || 'production',
    documentId,
    documentType,
    projectId: import.meta.env.SANITY_APP_PROJECT_ID,
    ...(isVersion && {versionId: translatedDocumentId}),
  }

  let bgColor: string
  let borderColor: string
  let textColor: string
  let stateLabel: string

  if (isVersion) {
    bgColor = '#E8DEFF'
    borderColor = '#7C5CDB'
    textColor = '#5E41A4'
    stateLabel = `In release: ${releaseName}`
  } else if (isDraft) {
    bgColor = '#FEF3C7'
    borderColor = '#D97706'
    textColor = '#92400E'
    stateLabel = 'Draft (not published)'
  } else {
    bgColor = '#D4FCEE'
    borderColor = '#0E784B'
    textColor = '#0E784B'
    stateLabel = 'Published'
  }

  return (
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
              {translatedDocumentTitle ? (
                <Text size={1} weight="semibold">
                  <OpenInStudioButton doc={documentHandle} text title={translatedDocumentTitle} />
                </Text>
              ) : (
                <TranslationDocumentWrapper doc={documentHandle} />
              )}
            </div>
          </Flex>

          <Flex align="center" className="flex-shrink-0" gap={2}>
            {workflowStatus && WORKFLOW_BADGE_CONFIG[workflowStatus] && (
              <Badge
                fontSize={0}
                padding={2}
                radius={3}
                tone={WORKFLOW_BADGE_CONFIG[workflowStatus].tone}
              >
                <Text size={1}>{WORKFLOW_BADGE_CONFIG[workflowStatus].label}</Text>
              </Badge>
            )}

            {isVersion && releaseName && (
              <Badge fontSize={0} padding={2} radius={3} tone="primary">
                <Text size={1}>{releaseName}</Text>
              </Badge>
            )}

            {isDraft && (
              <Badge fontSize={0} padding={2} radius={3} tone="caution">
                <Text size={1}>Draft</Text>
              </Badge>
            )}

            <Tooltip
              className="cursor-pointer"
              content={
                <Box padding={1}>
                  <Text muted size={1}>
                    {stateLabel}
                  </Text>
                </Box>
              }
            >
              <span
                className={`w-1.5 h-1.5 flex rounded-full ${
                  isVersion
                    ? 'bg-[var(--card-badge-primary-dot-color)]'
                    : isDraft
                      ? 'bg-[var(--card-badge-caution-dot-color)]'
                      : 'bg-[var(--card-badge-positive-dot-color)]'
                }`}
              />
            </Tooltip>

            <OpenInStudioButton doc={documentHandle} mode="bleed" size={0} />
          </Flex>
        </Flex>
      </Stack>
    </Card>
  )
}
