/**
 * Document-level translation inspector.
 *
 * Two shapes, one per side of the source/translation relationship:
 * - on the source, the open localization run plus locale coverage;
 * - on a translation, the compare against what is published, and a way back to
 *   the source — review is one pass over the whole document, so the verbs live
 *   on the source side only.
 */

import {TranslateIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {
  DocumentStatusIndicator,
  getPublishedId,
  useDocumentVersionInfo,
  usePerspective,
  useTranslation,
} from 'sanity'
import {useRouter} from 'sanity/router'

import {useLocales} from '../L10nProvider'
import {type ResolvedTranslationsConfig} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'
import {buildEditIntent, type EditTarget} from './editIntent'
import {ErrorBoundary} from './ErrorBoundary'
import {InspectorFrame} from './InspectorFrame'
import {LocalizationRun} from './LocalizationRun'
import {TranslationCompare} from './TranslationCompare'
import {useBaseDocumentId, useTranslationTargets} from './useTranslationTargets'
import {useLocalizationInstance} from './workflowEngine'

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

function TargetStatusDot({documentId}: {documentId: string}) {
  const {draft, published, versions} = useDocumentVersionInfo(documentId)
  return <DocumentStatusIndicator draft={draft} published={published} versions={versions} />
}

function CoverageRow({
  flag,
  title,
  localeId,
  targetDocumentId,
  onNavigate,
}: {
  flag: string
  title: string
  localeId: string
  targetDocumentId: string | undefined
  onNavigate: (documentId: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)

  return (
    <Flex align="center" gap={3} paddingX={3} paddingY={2}>
      {flag && <Text size={3}>{flag}</Text>}
      {targetDocumentId ? (
        <TargetStatusDot documentId={targetDocumentId} />
      ) : (
        <Box
          style={{
            background: 'var(--card-badge-critical-fg-color)',
            borderRadius: '50%',
            flexShrink: 0,
            height: 5,
            width: 5,
          }}
        />
      )}
      <Stack space={2}>
        <Text size={1} weight="medium">
          {title}
        </Text>
        <Text muted size={0}>
          {localeId}
        </Text>
      </Stack>
      <Box flex={1} />
      {targetDocumentId ? (
        <Button
          fontSize={0}
          mode="bleed"
          onClick={() => onNavigate(targetDocumentId)}
          padding={2}
          text={t('translations.go-to')}
        />
      ) : (
        <Text muted size={0}>
          {t('status.missing.label')}
        </Text>
      )}
    </Flex>
  )
}

function SourceInspector({
  documentId,
  documentType,
  config,
  onClose,
  onNavigate,
  onOpenMetadata,
  onEditField,
}: {
  documentId: string
  documentType: string
  config: ResolvedTranslationsConfig
  onClose?: () => void
  onNavigate: (documentId: string) => void
  onOpenMetadata: (documentId: string) => void
  onEditField: (target: EditTarget) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const locales = useLocales()
  const {metadataId, documentIdByLocale} = useTranslationTargets(documentId)
  const {instanceId, loading, error} = useLocalizationInstance(documentId)

  const targetLocales = (locales ?? []).filter((locale) => locale.id !== config.defaultLanguage)
  const covered = targetLocales.filter((locale) => documentIdByLocale.has(locale.id)).length

  return (
    <InspectorFrame metadataId={metadataId} onClose={onClose} onOpenMetadata={onOpenMetadata}>
      <Stack space={4}>
        {instanceId ? (
          <LocalizationRun
            documentType={documentType}
            instanceId={instanceId}
            onEditField={onEditField}
          />
        ) : (
          <Card border padding={3} radius={2} tone="transparent">
            <Text muted size={1}>
              {loading
                ? 'Checking for an open localization run…'
                : error
                  ? 'Could not reach the workflow engine. Localization state is unavailable.'
                  : 'No localization run is open. Start one from the Workflows strip above the form.'}
            </Text>
          </Card>
        )}

        {targetLocales.length === 0 ? (
          <Card border padding={3} radius={2} tone="transparent">
            <Text align="center" muted size={1}>
              {t('translations.no-locales')}
            </Text>
          </Card>
        ) : (
          <Card border radius={2} style={{overflow: 'hidden'}}>
            <Stack space={0}>
              <Card borderBottom padding={3} tone="transparent">
                <Text size={1} weight="semibold">
                  {t('translations.progress', {completed: covered, total: targetLocales.length})}
                </Text>
              </Card>
              {targetLocales.map((locale) => (
                <CoverageRow
                  flag={locale.flag}
                  key={locale.id}
                  localeId={locale.id}
                  onNavigate={onNavigate}
                  targetDocumentId={documentIdByLocale.get(locale.id)}
                  title={locale.title}
                />
              ))}
            </Stack>
          </Card>
        )}
      </Stack>
    </InspectorFrame>
  )
}

function TranslationInspectorView({
  documentId,
  documentType,
  documentLanguage,
  baseDocumentId,
  onClose,
  onNavigate,
  onOpenMetadata,
  onEditField,
}: {
  documentId: string
  documentType: string
  documentLanguage: string
  baseDocumentId: string
  onClose?: () => void
  onNavigate: (documentId: string) => void
  onOpenMetadata: (documentId: string) => void
  onEditField: (target: EditTarget) => void
}) {
  const {metadataId} = useTranslationTargets(baseDocumentId)
  const {selectedReleaseId} = usePerspective()

  return (
    <InspectorFrame metadataId={metadataId} onClose={onClose} onOpenMetadata={onOpenMetadata}>
      <Stack space={4}>
        <Card border padding={3} radius={2} tone="transparent">
          <Stack space={3}>
            <Text size={1}>
              {`The ${documentLanguage} translation. Review and approval happen on the source document.`}
            </Text>
            <Flex>
              <Button
                fontSize={1}
                mode="ghost"
                onClick={() => onNavigate(baseDocumentId)}
                padding={3}
                text="Open source document"
              />
            </Flex>
          </Stack>
        </Card>
        <TranslationCompare
          documentId={documentId}
          documentType={documentType}
          onEditField={(fieldName) =>
            onEditField({documentId, fieldName, releaseName: selectedReleaseId})
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

  const onNavigate = useCallback(
    (targetDocumentId: string) => {
      router.navigateIntent('edit', {id: getPublishedId(targetDocumentId), type: documentType})
    },
    [router, documentType],
  )

  // The field path is what turns "open the document" into "edit this field":
  // the reviewer lands on the field in the real editor rather than a bespoke one.
  // `navigateIntent` cannot carry search params, so the link is resolved with
  // the run's perspective and navigated to — the composition `useIntentLink`
  // itself uses.
  const onEditField = useCallback(
    (target: EditTarget) => {
      const {params, searchParams} = buildEditIntent(target, documentType)
      router.navigateUrl({path: router.resolveIntentLink('edit', params, searchParams)})
    },
    [router, documentType],
  )

  const onOpenMetadata = useCallback(
    (targetDocumentId: string) => {
      router.navigateIntent('edit', {id: targetDocumentId, type: 'translation.metadata'})
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
        <SourceInspector
          config={config}
          documentId={documentId}
          documentType={documentType}
          onClose={onClose}
          onEditField={onEditField}
          onNavigate={onNavigate}
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
          onEditField={onEditField}
          onNavigate={onNavigate}
          onOpenMetadata={onOpenMetadata}
        />
      )}
    </ErrorBoundary>
  )
}
