import type {Locale} from '../../helpers/getLocales'

import {CheckmarkCircleIcon, EmptyIcon, Progress50Icon, Progress75Icon} from '@sanity/icons'
import {Box, Card, Flex, Heading, Spinner, Stack, Text} from '@sanity/ui'

import type {BaseDocument} from '../../types/documents'
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '../Accordion/Accordion'
import TranslationLanguageItem from '../DocumentDetail/TranslationLanguageItem'
import {StatusBadge} from '../StatusBadge'
import type {
  BatchProcessState,
  DocumentTranslationProgress,
  EnhancedDocument,
  Language,
} from './types'

type DocumentAccordionItemProps = {
  currentState: BatchProcessState
  documentType: string
  fullyTranslatedDocuments: EnhancedDocument[]
  invalidDocuments: EnhancedDocument[]
  isValidating: boolean
  languages: Language[]
  releaseMap: Map<string, string>
  selectedDocuments: string[]
  selectedRelease: null | string
  translationProgress: Record<string, DocumentTranslationProgress>
  validDocuments: EnhancedDocument[]
}

const DocumentAccordionItem = ({
  documentType,
  fullyTranslatedDocuments,
  invalidDocuments,
  isValidating,
  languages,
  releaseMap,
  selectedDocuments,
  selectedRelease,
  translationProgress,
  validDocuments,
}: DocumentAccordionItemProps) => {
  if (selectedDocuments.length === 0) return null

  return (
    <Card className="max-h-300 overflow-y-auto sticky top-0">
      <Stack space={3}>
        {isValidating && (
          <Flex align="center" gap={2} paddingY={2}>
            <Spinner size={0} />
            <Text muted size={1}>
              Validating documents...
            </Text>
          </Flex>
        )}

        {!isValidating && (
          <Accordion className="w-full" type="multiple">
            {selectedDocuments.map((docId) => {
              const validDoc = validDocuments.find((doc) => doc._id === docId)
              const invalidDoc = invalidDocuments.find((doc) => doc._id === docId)
              const fullyTranslatedDoc = fullyTranslatedDocuments.find((doc) => doc._id === docId)

              const doc = validDoc || invalidDoc || fullyTranslatedDoc

              // Determine status
              let statusColorClass: string

              if (validDoc) {
                statusColorClass = 'bg-gray-500'
              } else if (fullyTranslatedDoc) {
                statusColorClass = 'bg-green-500'
              } else if (invalidDoc) {
                statusColorClass = 'bg-yellow-500'
              } else {
                statusColorClass = 'bg-yellow-500'
              }

              if (!doc) {
                return (
                  <AccordionItem key={docId} value={docId}>
                    <AccordionTrigger>
                      <Flex align="center" gap={2}>
                        <Box
                          className={`w-1.5 h-1.5 ${statusColorClass} rounded-full flex-shrink-0`}
                        />
                        <Text size={1} weight="medium">
                          Document (validation pending)
                        </Text>
                      </Flex>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Text className="font-mono opacity-50" muted size={0}>
                        ID: {docId.substring(0, 8)}...
                      </Text>
                    </AccordionContent>
                  </AccordionItem>
                )
              }

              const typedDoc = doc as unknown as {language: null | string} & BaseDocument
              const enhancedDoc = doc as EnhancedDocument

              // Get summary counts
              const summaryCount = enhancedDoc._summaryCount || {
                fallback: 0,
                inRelease: 0,
                missing: 0,
                translated: 0,
              }

              return (
                <AccordionItem key={docId} value={docId}>
                  <AccordionTrigger>
                    <Flex align="center" className="flex-1" gap={2} justify="space-between">
                      <Flex align="center" className="flex-1 min-w-0" gap={2}>
                        <Heading as="h3" className="min-w-0" size={1} weight="medium">
                          {typedDoc.title || 'Untitled'}
                        </Heading>
                      </Flex>
                      <Flex align="center" className="shrink-0" gap={1}>
                        <StatusBadge
                          icon={CheckmarkCircleIcon}
                          minWidth="2rem"
                          text={summaryCount.translated.toString()}
                          tone="positive"
                          tooltip={`${summaryCount.translated} completed translations`}
                        />

                        <StatusBadge
                          icon={Progress75Icon}
                          minWidth="2rem"
                          text={summaryCount.inRelease.toString()}
                          tone="suggest"
                          tooltip={`${summaryCount.inRelease} translations in release`}
                        />

                        <StatusBadge
                          icon={Progress50Icon}
                          minWidth="2rem"
                          text={summaryCount.fallback.toString()}
                          tone="caution"
                          tooltip={`${summaryCount.fallback} translations using fallback`}
                        />

                        <StatusBadge
                          icon={EmptyIcon}
                          minWidth="2rem"
                          text={summaryCount.missing.toString()}
                          tone="critical"
                          tooltip={`${summaryCount.missing} translations missing`}
                        />
                      </Flex>
                    </Flex>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Stack space={2}>
                      {languages
                        .filter((lang) => lang.id !== typedDoc.language)
                        .map((language) => {
                          const translationStatus =
                            enhancedDoc._translationsByLanguage?.[language.id]
                          if (!translationStatus) return null

                          // Check for active progress (creating, created, failed)
                          const progressItem = translationProgress[docId]?.translations.find(
                            (t) => t.languageId === language.id,
                          )
                          const hasActiveProgress =
                            progressItem &&
                            ['created', 'creating', 'failed'].includes(progressItem.status)

                          // Map batch status to single mode status
                          let status:
                            | 'completed'
                            | 'completing'
                            | 'failed'
                            | 'missing'
                            | 'translating'
                          if (hasActiveProgress && progressItem) {
                            if (progressItem.status === 'creating') {
                              status = 'translating'
                            } else if (progressItem.status === 'created') {
                              status = 'completed'
                            } else {
                              status = 'failed'
                            }
                          } else {
                            status =
                              translationStatus.status === 'completed' ? 'completed' : 'missing'
                          }

                          // Find fallback language if applicable
                          const fallbackLanguage =
                            translationStatus.status === 'fallback'
                              ? (languages.find((l) => l.id === language.fallbackLocale) as
                                  | Locale
                                  | undefined)
                              : undefined

                          return (
                            <TranslationLanguageItem
                              disabled
                              documentType={documentType}
                              fallbackExists={translationStatus.status === 'fallback'}
                              fallbackLanguage={fallbackLanguage}
                              key={language.id}
                              languageId={language.id}
                              languageTitle={language.title}
                              locale={language as Locale}
                              progress={progressItem?.status === 'creating' ? 50 : 100}
                              releaseMap={releaseMap}
                              releaseName={translationStatus.releaseName}
                              selectedRelease={selectedRelease}
                              status={status}
                              translatedDocumentId={translationStatus.translatedDocumentId}
                              translatedDocumentTitle={translationStatus.translatedDocumentTitle}
                            />
                          )
                        })}
                    </Stack>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </Stack>
    </Card>
  )
}

export default DocumentAccordionItem
