import type {Locale} from '../../helpers/getLocales'
import {DocumentId} from '@sanity/id-utils'
import {type DocumentHandle, useDocumentProjection} from '@sanity/sdk-react'
import {Stack} from '@sanity/ui'
import {useEffect, useRef} from 'react'

import {useApp} from '../../contexts/AppContext'
import {useAutoProvisionMetadata} from '../../hooks/useAutoProvisionMetadata'
import {useTranslationConfig} from '../../contexts/TranslationConfigContext'
import {DOCUMENT_DETAIL_QUERY} from '../../queries/documentQueries'
import type {DocumentDetailData} from '../../types/documents'
import {documentTypeLabels} from '../DocumentTypeSelector'
import Loading from '../Loading'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import Header from './Header'
import TranslationsList, {type Translation} from './TranslationsList'

type DocumentDetailProps = {
  selectedPost: DocumentHandle | null
}

const DocumentDetailContent = ({selectedPost}: {selectedPost: DocumentHandle}) => {
  const {languages} = useTranslationConfig()
  const {clearTranslationProgress, isCreating, setCreationStatus, setSelectedPost} = useApp()
  const previousDocumentId = useRef<null | string>(null)

  const handleClose = () => {
    setSelectedPost(null)
  }

  // Clear translation context state only when switching to a different document
  useEffect(() => {
    if (selectedPost) {
      const currentDocumentId = selectedPost.documentId

      // Only clear if we're switching to a different document (not the same one)
      if (previousDocumentId.current && previousDocumentId.current !== currentDocumentId) {
        if (!isCreating) {
          setCreationStatus(null)
          clearTranslationProgress()
        }
      }

      // Update the previous document ID
      previousDocumentId.current = currentDocumentId
    }
  }, [selectedPost, isCreating, setCreationStatus, clearTranslationProgress])

  const detailRef = useRef(null)

  const {data} = useDocumentProjection<DocumentDetailData>({
    ...selectedPost,
    projection: DOCUMENT_DETAIL_QUERY,
    ref: detailRef,
  })

  // Auto-provision metadata if document has language but no metadata
  const {isProvisioning} = useAutoProvisionMetadata({
    documentId: data?._id,
    hasMetadata: data?._hasMetadata,
    language: data?.language,
    schemaType: selectedPost?.documentType || 'article',
  })

  if (isProvisioning) {
    return <Loading />
  }

  if (!data) {
    return <ErrorState />
  }

  return (
    <Stack padding={4} ref={detailRef} space={4}>
      <Header
        documentId={data._id}
        language={data.language}
        onClose={handleClose}
        title={data.title}
      />
      {/* Show TranslationsList if document has language */}
      {data.language && (
        <TranslationsList
          availableLanguages={languages as Locale[]}
          baseDocumentId={data._id as DocumentId}
          baseLanguage={data.language}
          currentLanguage={data.language}
          documentType={selectedPost?.documentType || 'article'}
          existingTranslations={
            (data._translations || []).filter((t) => t && t.language) as unknown as Translation[]
          }
          key={data._id}
          metadataId={data._translationMetadataId?.[0]}
        />
      )}
    </Stack>
  )
}

const DocumentDetail = ({selectedPost}: DocumentDetailProps) => {
  const {selectedDocumentType} = useApp()

  if (!selectedPost) {
    return (
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <EmptyState selectedDocumentType={documentTypeLabels[selectedDocumentType].slice(0, -1)} />
      </div>
    )
  }

  return (
    <div className="sticky top-0">
      <DocumentDetailContent selectedPost={selectedPost} />
    </div>
  )
}

export default DocumentDetail
