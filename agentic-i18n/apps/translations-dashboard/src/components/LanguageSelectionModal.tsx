import {CloseIcon} from '@sanity/icons'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useState} from 'react'
import type {SanityDocument} from 'sanity'

import {useSetDocumentLanguage} from '../hooks/useSetDocumentLanguage'
import LocaleFallbackMessage from './LocaleFallbackMessage'

type LanguageSelectionModalProps = {
  availableLanguages: Array<{id: string; title: string}>
  documentId?: string
  documentType: string
  isOpen: boolean
  onClose: () => void
  onLanguageSelect: (languageId: string) => void
  sourceDocument?: SanityDocument
  title?: string
}

const LanguageSelectionModal = ({
  availableLanguages,
  documentId,
  documentType,
  isOpen,
  onClose,
  onLanguageSelect,
  sourceDocument,
  title = 'Select Base Language',
}: LanguageSelectionModalProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<null | string>(null)
  const {isSettingLanguage, setDocumentLanguage} = useSetDocumentLanguage()

  const handleConfirm = useCallback(async () => {
    if (!selectedLanguage || !documentId || !sourceDocument) {
      return
    }

    try {
      await setDocumentLanguage({
        availableLanguages,
        documentId,
        documentType,
        languageId: selectedLanguage,
        sourceDocument,
      })

      onLanguageSelect(selectedLanguage)
      setSelectedLanguage(null)
    } catch (error) {
      // Error handling is done in the hook
      console.error('Failed to set document language:', error)
    }
  }, [
    selectedLanguage,
    documentId,
    sourceDocument,
    availableLanguages,
    documentType,
    setDocumentLanguage,
    onLanguageSelect,
  ])

  const handleCancel = () => {
    setSelectedLanguage(null)
    onClose()
  }

  // Show fallback message if no languages are available
  if (!availableLanguages || availableLanguages.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100">
        <Card padding={4} radius={3} shadow={3} className="w-[90%] max-w-[400px]">
          <LocaleFallbackMessage
            buttonText="Refresh Page"
            message="Cannot open language selection without available languages."
            onButtonClick={() => window.location.reload()}
            suggestion="Please wait for languages to load or refresh the page."
            title="No Languages Available"
            variant="error"
          />
        </Card>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card padding={4} radius={3} shadow={3} className="w-[90%] max-w-[400px]">
        <Stack space={4}>
          <Flex align="center" gap={2} justify="space-between">
            <Text size={3} weight="semibold">
              {title}
            </Text>
            <Button fontSize={1} icon={CloseIcon} mode="bleed" onClick={handleCancel} padding={2} />
          </Flex>

          <Text muted size={1}>
            This document doesn&apos;t have a base language set. Please select the language for this
            document to continue with translation creation.
          </Text>

          <Stack space={2}>
            {availableLanguages.map((language) => (
              <Button
                className="justify-start"
                key={language.id}
                mode={selectedLanguage === language.id ? 'default' : 'ghost'}
                onClick={() => setSelectedLanguage(language.id)}
                text={`${language.title} (${language.id})`}
              />
            ))}
          </Stack>

          <Flex gap={2} justify="flex-end">
            <Button mode="ghost" onClick={handleCancel} text="Cancel" />
            <Button
              disabled={!selectedLanguage || isSettingLanguage || !sourceDocument}
              loading={isSettingLanguage}
              mode="default"
              onClick={handleConfirm}
              text={isSettingLanguage ? 'Setting language...' : 'Confirm'}
            />
          </Flex>
        </Stack>
      </Card>
    </div>
  )
}

export default LanguageSelectionModal
