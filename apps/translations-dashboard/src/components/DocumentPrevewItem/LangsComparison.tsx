import type {MetadataDocument as TranslationMetadata} from '@sanity/document-internationalization'

import {Flex, Stack, Text} from '@sanity/ui'

import type {LanguageData} from '../../contexts/AppContext'

import LocaleFallbackMessage from '../LocaleFallbackMessage'

// this is a little component to show which languages are translated and which are not
const LangsComparison = ({
  langs,
  translations,
}: {
  langs: LanguageData[]
  translations: TranslationMetadata
}) => {
  // Show fallback message if no languages are available
  if (!langs || langs.length === 0) {
    return (
      <LocaleFallbackMessage
        buttonText="Refresh Page"
        message="Cannot display language comparison without available languages."
        suggestion="Please wait for languages to load or refresh the page."
        title="No Languages Available"
        variant="warning"
      />
    )
  }

  return (
    <Stack space={2}>
      {langs?.map((lang) => {
        //@ts-ignore
        const hasTranslation = translations?.some(
          (translation: TranslationMetadata) => translation && translation.language === lang.id,
        )
        return (
          <Text key={lang.id} muted={!hasTranslation} size={12}>
            <Flex align="center" gap={2} justify="space-between" padding={0}>
              <span>{lang.id}</span>
              <span className="text-[10px]">{hasTranslation ? '✅' : '❌'}</span>
            </Flex>
          </Text>
        )
      })}
    </Stack>
  )
}

export default LangsComparison
