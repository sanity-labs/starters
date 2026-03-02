import {Badge, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useState} from 'react'
import type {SanityDocument} from 'sanity'

import LanguageSelectionModal from '../LanguageSelectionModal'

type SetDocumentLanguageProps = {
  documentId?: string
  documentType: string
  languages: Array<{id: string; title: string}>
  onLanguageSet?: (languageId: string) => void
  sourceDocument?: SanityDocument
}

const SetDocumentLanguage = ({
  documentId,
  documentType,
  languages,
  onLanguageSet,
  sourceDocument,
}: SetDocumentLanguageProps) => {
  const [showLanguageModal, setShowLanguageModal] = useState(false)

  const handleLanguageSelect = useCallback(
    async (languageId: string) => {
      setShowLanguageModal(false)

      if (onLanguageSet) {
        onLanguageSet(languageId)
      }
    },
    [onLanguageSet],
  )

  const handleCloseModal = () => {
    setShowLanguageModal(false)
  }

  const handleSetLanguage = () => {
    if (documentId && sourceDocument) {
      setShowLanguageModal(true)
    }
  }

  return (
    <>
      <Card border padding={3} tone="primary">
        <Stack space={3}>
          <Flex align="center" gap={2}>
            <Badge
              className={documentId && sourceDocument ? 'cursor-pointer' : 'cursor-default'}
              onClick={handleSetLanguage}
              padding={2}
              radius={2}
              tone="critical"
            >
              Start translation
            </Badge>
          </Flex>
          <Text muted size={1}>
            This document needs a base language before translations can be created. Click the badge
            above to select a language.
          </Text>
        </Stack>
      </Card>

      <LanguageSelectionModal
        availableLanguages={languages}
        documentId={documentId}
        documentType={documentType}
        isOpen={showLanguageModal}
        onClose={handleCloseModal}
        onLanguageSelect={handleLanguageSelect}
        sourceDocument={sourceDocument}
        title="Set Document Language"
      />
    </>
  )
}

export default SetDocumentLanguage
