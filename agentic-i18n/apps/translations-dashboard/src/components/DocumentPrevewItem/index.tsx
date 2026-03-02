import {EmptyIcon, Progress50Icon} from '@sanity/icons'
import {type DocumentHandle, useDocumentProjection} from '@sanity/sdk-react'
import {Flex, Text} from '@sanity/ui'
import {Suspense, useRef} from 'react'

import {useTranslationConfig} from '../../contexts/TranslationConfigContext'
import {DOCUMENT_PREVIEW_QUERY} from '../../queries/documentQueries'
import {StatusBadge} from '../StatusBadge'
import TranslationStatusBadge, {TranslationStatusBadgeSkeleton} from '../TranslationStatusBadge'

type DocumentPreviewData = {
  _createdAt: string
  _id: string
  _translationMetadataRef?: string
  language: null | string
  title: null | string
}

const DocumentPreviewItem = (props: DocumentHandle) => {
  const {languages} = useTranslationConfig()
  const previewRef = useRef<HTMLDivElement>(null)
  const {data, isPending} = useDocumentProjection<DocumentPreviewData>({
    ...props,
    perspective: 'raw',
    projection: DOCUMENT_PREVIEW_QUERY,
    ref: previewRef,
  })

  const showPlaceholder = isPending && !data

  return (
    <Flex direction={'column'} gap={4} ref={previewRef}>
      <Text weight="medium">{showPlaceholder ? '...' : data?.title || 'Untitled'}</Text>
      {data?._translationMetadataRef ? (
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => {
            if (lang.id === 'en-US') return null
            const metadataId = data._translationMetadataRef! // Non-null assertion since we checked above
            return (
              <Suspense fallback={<TranslationStatusBadgeSkeleton locale={lang} />} key={lang.id}>
                <TranslationStatusBadge locale={lang} metadataId={metadataId} />
              </Suspense>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => {
            if (lang.id === 'en-US') return null

            // en-GB and en-CA should show fallback state, others show missing
            const isFallbackLanguage = lang.id === 'en-GB' || lang.id === 'en-CA'

            return (
              <StatusBadge
                icon={isFallbackLanguage ? Progress50Icon : EmptyIcon}
                key={lang.id}
                text={lang.id}
                tone={isFallbackLanguage ? 'caution' : 'critical'}
                tooltip={
                  isFallbackLanguage
                    ? `This document uses fallback language ${lang.title}`
                    : `This document is missing a translation for ${lang.title}`
                }
              />
            )
          })}
        </div>
      )}
    </Flex>
  )
}

export default DocumentPreviewItem

export const DocumentPreviewItemSkeleton = () => {
  const {languages} = useTranslationConfig()

  // Filter out the default language (en-US) to match the real component behavior
  const nonDefaultLanguages = languages.filter((lang) => lang.id !== 'en-US')

  return (
    <Flex direction={'column'} gap={4}>
      <div className="animate-pulse h-3 w-1/2 bg-gray-200 rounded-md" />
      <div className="flex flex-wrap gap-2">
        {nonDefaultLanguages.map((lang) => (
          <TranslationStatusBadgeSkeleton key={lang.id} locale={lang} />
        ))}
      </div>
    </Flex>
  )
}
