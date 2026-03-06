import {type DocumentHandle, useDocumentProjection} from '@sanity/sdk-react'
import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {useRef} from 'react'

import {BATCH_DOCUMENT_PREVIEW_QUERY} from '../../queries/documentQueries'
import type {BaseDocument, TranslationData} from '../../types/documents'
import TranslationProgress from './TranslationProgress'
import type {BatchProcessState, DocumentTranslationProgress, Language, Translation} from './types'

type DocumentItemProps = {
  currentState: BatchProcessState
  dataMap?: DocumentHandle
  document: {language: null | string} & BaseDocument
  fallbackDocumentId?: string
  isFullyTranslated: boolean
  isInvalid: boolean
  isValid: boolean
  languages: Language[]
  translationProgress?: DocumentTranslationProgress
}

const DocumentItem = ({
  currentState,
  dataMap,
  document,
  fallbackDocumentId,
  isFullyTranslated,
  isInvalid,
  isValid,
  languages,
  translationProgress,
}: DocumentItemProps) => {
  const itemRef = useRef(null)
  const {data} = useDocumentProjection<TranslationData>({
    dataset: dataMap?.dataset || 'production',
    documentId: dataMap?.documentId || document?._id || fallbackDocumentId || '',
    documentType: dataMap?.documentType || document?._type || '',
    projectId: dataMap?.projectId || import.meta.env.SANITY_APP_PROJECT_ID,
    projection: BATCH_DOCUMENT_PREVIEW_QUERY,
    ref: itemRef,
  })

  if (!document && fallbackDocumentId) {
    return (
      <Card
        className="border border-gray-200"
        key={fallbackDocumentId}
        padding={2}
        radius={1}
        tone="caution"
      >
        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Box className="w-1.5 h-1.5 bg-yellow-500 rounded-full flex-shrink-0" />
            <Text size={1} weight="medium">
              Document (validation pending)
            </Text>
          </Flex>
          <Flex align="flex-start" gap={2} paddingLeft={2}>
            <Text className="text-yellow-500 leading-none" size={0}>
              ⚠️
            </Text>
            <Stack className="flex-1" space={1}>
              <Text muted size={0}>
                Unable to validate - may still be processed
              </Text>
              <Text className="font-mono opacity-50" muted size={0}>
                ID: {fallbackDocumentId.substring(0, 8)}...
              </Text>
            </Stack>
          </Flex>
        </Stack>
      </Card>
    )
  }

  if (!document) return null

  let statusIcon: string
  let statusColorClass: string
  let statusTextColorClass: string
  let statusMessage: string
  let badgeTone: 'caution' | 'critical' | 'default' | 'neutral' | 'positive' | 'primary' | 'suggest'
  let cardTone:
    | 'caution'
    | 'critical'
    | 'default'
    | 'neutral'
    | 'positive'
    | 'primary'
    | 'suggest'
    | 'transparent'

  if (isValid) {
    statusIcon = '✅'
    statusColorClass = 'bg-gray-500'
    statusTextColorClass = 'text-gray-500'
    statusMessage = 'Will create missing translations'
    badgeTone = 'default'
    cardTone = 'default'
  } else if (isFullyTranslated) {
    statusIcon = '⚪'
    statusColorClass = 'bg-green-500'
    statusTextColorClass = 'text-green-500'
    statusMessage = "Already fully translated - (we'll skip this one)"
    badgeTone = 'positive'
    cardTone = 'positive'
  } else if (isInvalid) {
    statusIcon = '⚠️'
    statusColorClass = 'bg-yellow-500'
    statusTextColorClass = 'text-yellow-500'
    statusMessage = 'Missing base language - needs to be configured first'
    badgeTone = 'caution'
    cardTone = 'caution'
  } else {
    statusIcon = '⚠️'
    statusColorClass = 'bg-yellow-500'
    statusTextColorClass = 'text-yellow-500'
    statusMessage = 'Unknown status'
    badgeTone = 'caution'
    cardTone = 'caution'
  }

  return (
    <Card
      className="border border-gray-200"
      key={document._id}
      padding={2}
      radius={1}
      ref={itemRef}
      tone={cardTone}
    >
      <Stack space={2}>
        <Flex align="center" gap={2}>
          <Box className={`w-1.5 h-1.5 ${statusColorClass} rounded-full flex-shrink-0`} />
          <Text className="flex-1" size={1} weight="medium">
            {document.title || 'Untitled'}
          </Text>
          {document.language && (
            <Badge fontSize={0} padding={1} radius={1} tone={badgeTone}>
              {document.language}
            </Badge>
          )}
        </Flex>
        <Flex align="center" gap={2} paddingLeft={2}>
          <Text className={`${statusTextColorClass} leading-none`} size={0}>
            {statusIcon}
          </Text>
          <Stack className="flex-1" space={1}>
            <Text muted size={0}>
              {statusMessage}
            </Text>
            <Text className="font-mono opacity-50" muted size={0}>
              ID: {document._id.substring(0, 8)}...
            </Text>
          </Stack>
        </Flex>

        <TranslationProgress
          documentLanguage={document.language}
          existingTranslations={(data?._translations || []) as unknown as Translation[]}
          languages={languages}
          progress={translationProgress!}
        />
      </Stack>
    </Card>
  )
}

export default DocumentItem
