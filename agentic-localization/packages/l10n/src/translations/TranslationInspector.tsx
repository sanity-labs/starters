/**
 * Translation Inspector — Document inspector wrapper.
 *
 * Renders the shared TranslationContent inside a document inspector panel.
 * Unlike the document view pane, the inspector receives only documentId,
 * documentType, and onClose — so it uses useDocumentLanguage to fetch
 * the language field value from the form state.
 */

import {ErrorOutlineIcon} from '@sanity/icons'
import {Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import type {DocumentInspectorProps} from 'sanity'

import {ErrorBoundary} from './ErrorBoundary'
import {TranslationContent} from './TranslationContent'
import type {ResolvedTranslationsConfig} from '../core/types'
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
