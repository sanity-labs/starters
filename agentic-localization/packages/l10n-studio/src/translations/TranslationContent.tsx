/**
 * Document-level translation inspector.
 *
 * Two shapes, one per side of the source/translation relationship:
 * - on the source, the review matrix — every target locale as a row, the fields
 *   the run moved as columns, the diff for whatever cell is selected;
 * - on a translation, the compare against what is published, and a way back to
 *   the source — review is one pass over the whole document, so the verbs live
 *   on the source side only.
 *
 * The locale coverage list the source side used to carry is gone: it said the
 * same thing as the grid's leftmost column, one screen further down.
 */

import {TranslateIcon} from '@sanity/icons'
import {Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {getPublishedId, usePerspective, useTranslation} from 'sanity'
import {useRouter} from 'sanity/router'

import {type ResolvedTranslationsConfig} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'
import {ErrorBoundary} from './ErrorBoundary'
import {InspectorFrame} from './InspectorFrame'
import {useOpenSiblingPane} from './paneNavigation'
import {ReviewMatrix} from './ReviewMatrix'
import {TranslationCompare} from './TranslationCompare'
import {useBaseDocumentId, useTranslationTargets} from './useTranslationTargets'

export interface TranslationContentProps {
  documentId: string
  documentType: string
  documentLanguage: string | undefined
  config: ResolvedTranslationsConfig
  onClose?: () => void
}

function EmptyState({message}: {message: string}) {
  return (
    <Card padding={4}>
      <Flex align="center" direction="column" gap={3} height="fill" justify="center">
        <Text align="center" muted size={2}>
          <TranslateIcon />
        </Text>
        <Text align="center" muted size={1}>
          {message}
        </Text>
      </Flex>
    </Card>
  )
}

function LoadingState() {
  return (
    <Flex align="center" justify="center" style={{height: '100%', minHeight: 200}}>
      <Spinner muted />
    </Flex>
  )
}

function TranslationInspectorView({
  documentId,
  documentType,
  documentLanguage,
  baseDocumentId,
  onClose,
  onOpenMetadata,
}: {
  documentId: string
  documentType: string
  documentLanguage: string
  baseDocumentId: string
  onClose?: () => void
  onOpenMetadata: (documentId: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const {metadataId} = useTranslationTargets(baseDocumentId)
  const {selectedReleaseId} = usePerspective()
  const openSibling = useOpenSiblingPane()

  return (
    <InspectorFrame metadataId={metadataId} onClose={onClose} onOpenMetadata={onOpenMetadata}>
      <Stack padding={3} space={4}>
        <Card border padding={3} radius={2} tone="transparent">
          <Stack space={3}>
            <Text size={1}>{t('translations.review-on-source', {language: documentLanguage})}</Text>
            <Flex>
              <Button
                fontSize={1}
                mode="ghost"
                onClick={() =>
                  openSibling({
                    documentId: baseDocumentId,
                    documentType,
                    releaseName: selectedReleaseId,
                  })
                }
                padding={3}
                text={t('translations.open-source')}
              />
            </Flex>
          </Stack>
        </Card>
        <TranslationCompare
          documentId={documentId}
          documentType={documentType}
          onEditField={(fieldName) =>
            openSibling({
              documentId,
              documentType,
              fieldName,
              releaseName: selectedReleaseId,
            })
          }
          releaseName={selectedReleaseId}
        />
      </Stack>
    </InspectorFrame>
  )
}

export function TranslationContent({
  documentId,
  documentType,
  documentLanguage,
  config,
  onClose,
}: TranslationContentProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const router = useRouter()

  const isBaseLanguage = !config.defaultLanguage || documentLanguage === config.defaultLanguage
  const baseDocumentId = useBaseDocumentId(documentId, config.defaultLanguage, !isBaseLanguage)

  const onOpenMetadata = useCallback(
    (targetDocumentId: string) => {
      router.navigateIntent('edit', {
        id: getPublishedId(targetDocumentId),
        type: 'translation.metadata',
      })
    },
    [router],
  )

  if (!config.internationalizedTypes.includes(documentType)) {
    return <EmptyState message={t('translations.not-configured', {documentType})} />
  }

  if (!documentLanguage) {
    return <EmptyState message={t('translations.no-language')} />
  }

  return (
    <ErrorBoundary featureName="Translation Pane">
      {isBaseLanguage ? (
        <ReviewMatrix
          defaultLanguage={config.defaultLanguage}
          documentId={documentId}
          documentType={documentType}
          onClose={onClose}
          onOpenMetadata={onOpenMetadata}
        />
      ) : baseDocumentId === undefined ? (
        <LoadingState />
      ) : !baseDocumentId ? (
        <EmptyState message={t('translations.no-base-document')} />
      ) : (
        <TranslationInspectorView
          baseDocumentId={baseDocumentId}
          documentId={documentId}
          documentLanguage={documentLanguage}
          documentType={documentType}
          onClose={onClose}
          onOpenMetadata={onOpenMetadata}
        />
      )}
    </ErrorBoundary>
  )
}
