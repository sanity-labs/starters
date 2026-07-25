/**
 * Field-level translation inspector.
 *
 * Same surface as the document tier, one document short. A `person` keeps every
 * locale in its own internationalized arrays, so there is no sibling document to
 * navigate to and no `translation.metadata` to open — but the run is the same
 * `localize-document` run, with the same per-locale children, so `LocalizationRun`
 * renders it unchanged. Coverage is derived from the arrays the same way the
 * analysis effect derives it: a locale counts only when every field carries it.
 */

import {Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {getPublishedId, useEditState, useTranslation} from 'sanity'
import {useRouter} from 'sanity/router'

import {coveredLocales, internationalizedFields} from '@starter/l10n'
import {useLocales} from '../L10nProvider'
import {l10nLocaleNamespace} from '../i18n'
import {buildEditIntent, type EditTarget} from './editIntent'
import {ErrorBoundary} from './ErrorBoundary'
import {InspectorFrame} from './InspectorFrame'
import {LocalizationRun} from './LocalizationRun'
import {useLocalizationInstance} from './workflowEngine'

export interface FieldTierContentProps {
  documentId: string
  documentType: string
  defaultLanguage: string | undefined
  onClose?: () => void
}

function CoverageCard({
  documentId,
  documentType,
  defaultLanguage,
}: {
  documentId: string
  documentType: string
  defaultLanguage: string | undefined
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const locales = useLocales()
  const editState = useEditState(getPublishedId(documentId), documentType)

  const targetLocales = (locales ?? []).filter((locale) => locale.id !== defaultLanguage)
  if (targetLocales.length === 0) {
    return (
      <Card border padding={3} radius={2} tone="transparent">
        <Text align="center" muted size={1}>
          {t('translations.no-locales')}
        </Text>
      </Card>
    )
  }

  const document = editState.draft ?? editState.published
  const covered = new Set(
    document ? coveredLocales(document, internationalizedFields(documentType)) : [],
  )

  return (
    <Card border radius={2} style={{overflow: 'hidden'}}>
      <Stack space={0}>
        <Card borderBottom padding={3} tone="transparent">
          <Text size={1} weight="semibold">
            {t('translations.progress', {
              completed: targetLocales.filter((locale) => covered.has(locale.id)).length,
              total: targetLocales.length,
            })}
          </Text>
        </Card>
        {targetLocales.map((locale) => (
          <Flex align="center" gap={3} key={locale.id} paddingX={3} paddingY={2}>
            {locale.flag && <Text size={3}>{locale.flag}</Text>}
            <Stack space={2}>
              <Text size={1} weight="medium">
                {locale.title}
              </Text>
              <Text muted size={0}>
                {locale.id}
              </Text>
            </Stack>
            <Box flex={1} />
            <Text muted size={0}>
              {covered.has(locale.id) ? t('translations.covered') : t('status.missing.label')}
            </Text>
          </Flex>
        ))}
      </Stack>
    </Card>
  )
}

export function FieldTierContent({
  documentId,
  documentType,
  defaultLanguage,
  onClose,
}: FieldTierContentProps) {
  const router = useRouter()
  const {instanceId, loading, error} = useLocalizationInstance(documentId)

  // The locale entries live in this document, so a jump is a jump within it —
  // the field path is what puts the reviewer on the entry rather than the top
  // of the form. `navigateIntent` cannot carry the perspective search param.
  const onEditField = useCallback(
    (target: EditTarget) => {
      const {params, searchParams} = buildEditIntent(target, documentType)
      router.navigateUrl({path: router.resolveIntentLink('edit', params, searchParams)})
    },
    [router, documentType],
  )

  return (
    <ErrorBoundary featureName="Translation Inspector">
      <InspectorFrame onClose={onClose}>
        <Stack space={4}>
          {instanceId ? (
            <LocalizationRun
              documentType={documentType}
              instanceId={instanceId}
              onEditField={onEditField}
            />
          ) : (
            <Card border padding={3} radius={2} tone="transparent">
              <Flex align="center" gap={2}>
                {loading && <Spinner muted />}
                <Text muted size={1}>
                  {loading
                    ? 'Checking for an open localization run…'
                    : error
                      ? 'Could not reach the workflow engine. Localization state is unavailable.'
                      : 'No localization run is open. Publishing this document starts one, or start it from the Workflows strip above the form.'}
                </Text>
              </Flex>
            </Card>
          )}
          <CoverageCard
            defaultLanguage={defaultLanguage}
            documentId={documentId}
            documentType={documentType}
          />
        </Stack>
      </InspectorFrame>
    </ErrorBoundary>
  )
}
