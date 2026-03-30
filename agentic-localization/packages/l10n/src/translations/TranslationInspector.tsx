/**
 * Translation Inspector — Document inspector wrapper.
 *
 * Routes between two rendering paths:
 * - Doc-level: documents in `internationalizedTypes` → existing TranslationContent
 * - Field-level: documents with `internationalizedArray*` fields → FieldTranslationContent
 * - Both: (future) tab switcher
 *
 * Doc-level path uses useDocumentLanguage to fetch the language field from form state.
 * Field-level path needs no language field — translations are inline arrays.
 */

import {ErrorOutlineIcon} from '@sanity/icons'
import {Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import type {DocumentInspectorProps} from 'sanity'

import {ErrorBoundary} from './ErrorBoundary'
import {TranslationContent} from './TranslationContent'
import {FieldTranslationContent} from './FieldTranslationContent'
import type {ResolvedTranslationsConfig} from '../core/types'
import {useDocumentLanguage} from './useDocumentLanguage'
import {useInternationalizedFields} from '../fieldActions/useInternationalizedFields'

interface TranslationInspectorInternalProps extends DocumentInspectorProps {
  config: ResolvedTranslationsConfig
}

function TranslationInspectorInternal({
  documentId,
  documentType,
  onClose,
  config,
}: TranslationInspectorInternalProps) {
  const isDocLevel = config.internationalizedTypes.includes(documentType)
  const i18nFields = useInternationalizedFields(documentType)
  const hasFieldLevel = i18nFields.length > 0

  // Field-level only — no language field needed
  if (hasFieldLevel && !isDocLevel) {
    return (
      <FieldTranslationContent
        documentId={documentId}
        documentType={documentType}
        onClose={onClose}
      />
    )
  }

  // Doc-level (with or without field-level — for now, doc-level takes priority)
  if (isDocLevel) {
    return (
      <DocLevelInspector
        documentId={documentId}
        documentType={documentType}
        onClose={onClose}
        config={config}
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
