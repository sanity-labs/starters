/**
 * Translation Inspector — Document inspector wrapper.
 *
 * Routes between the two localization tiers:
 * - document tier (`internationalizedTypes`, e.g. `article`) → `TranslationContent`
 * - field tier (`internationalizedArray` fields, e.g. `person`) → `FieldTierContent`
 *
 * Both render the same open `localize-document` run; they differ only in where a
 * locale's translation lives. The document tier needs the subject's language
 * field to tell a source from a translation, which the field tier has no use for
 * — its locales are entries in the one document.
 */

import {ErrorOutlineIcon} from '@sanity/icons'
import {Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import type {DocumentInspectorProps} from 'sanity'

import {isFieldTier} from '../core/fieldTier'
import type {ResolvedTranslationsConfig} from '../core/types'
import {ErrorBoundary} from './ErrorBoundary'
import {FieldTierContent} from './FieldTierContent'
import {TranslationContent} from './TranslationContent'
import {useDocumentLanguage} from './useDocumentLanguage'

interface TranslationInspectorInternalProps extends DocumentInspectorProps {
  config: ResolvedTranslationsConfig
}

function TranslationInspectorInternal({
  documentId,
  documentType,
  onClose,
  config,
}: TranslationInspectorInternalProps) {
  // A type could in principle be both; the document tier owns it if so, because
  // its language field is what identifies the source everything else hangs off.
  if (config.internationalizedTypes.includes(documentType)) {
    return (
      <DocLevelInspector
        config={config}
        documentId={documentId}
        documentType={documentType}
        onClose={onClose}
      />
    )
  }

  if (isFieldTier(documentType)) {
    return (
      <FieldTierContent
        defaultLanguage={config.defaultLanguage}
        documentId={documentId}
        documentType={documentType}
        onClose={onClose}
      />
    )
  }

  // Neither — shouldn't happen if useMenuItem hides correctly, but handle gracefully
  return null
}

function DocLevelInspector({
  documentId,
  documentType,
  onClose,
  config,
}: TranslationInspectorInternalProps) {
  const langResult = useDocumentLanguage(documentId, config.languageField)

  if (langResult.isLoading) {
    return (
      <Flex align="center" justify="center" style={{height: '100%', minHeight: 200}}>
        <Spinner muted />
      </Flex>
    )
  }

  if (langResult.error) {
    return (
      <Card padding={4} tone="critical" border radius={2}>
        <Stack space={3}>
          <Flex align="center" gap={2}>
            <Text size={1}>
              <ErrorOutlineIcon />
            </Text>
            <Text size={1} weight="medium">
              Failed to load document language
            </Text>
          </Flex>
          <Text size={1} muted>
            {langResult.error.message}
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <ErrorBoundary featureName="Translation Inspector">
      <Box style={{height: '100%'}}>
        <TranslationContent
          documentId={documentId}
          documentType={documentType}
          documentLanguage={langResult.language}
          config={config}
          onClose={onClose}
        />
      </Box>
    </ErrorBoundary>
  )
}

/**
 * Create a TranslationInspector component bound to a specific config.
 * Used by `createTranslationInspector()` to produce the inspector's component.
 */
export function createTranslationInspectorComponent(config: ResolvedTranslationsConfig) {
  function BoundTranslationInspector(props: DocumentInspectorProps) {
    return <TranslationInspectorInternal {...props} config={config} />
  }

  BoundTranslationInspector.displayName = 'TranslationInspector'
  return BoundTranslationInspector
}
