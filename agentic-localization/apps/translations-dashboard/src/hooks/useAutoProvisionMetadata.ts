import {useClient} from '@sanity/sdk-react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {getPublishedId} from 'sanity'

import {useApp} from '../contexts/AppContext'
import {buildMetadataDocument, METADATA_EXISTS_QUERY} from '../lib/metadata'

type AutoProvisionMetadataParams = {
  documentId?: string
  hasMetadata?: boolean
  language?: null | string
  schemaType?: string
}

/**
 * Hook that automatically provisions translation metadata for documents
 * that have a language set but no metadata yet
 */
export const useAutoProvisionMetadata = ({
  documentId,
  hasMetadata,
  language,
  schemaType = 'article',
}: AutoProvisionMetadataParams) => {
  const {sanityClientConfig} = useApp()
  const client = useClient(sanityClientConfig)

  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisioningError, setProvisioningError] = useState<null | string>(null)
  const hasProvisionedRef = useRef<Set<string>>(new Set())

  const provisionMetadata = useCallback(
    async (docId: string, lang: string, schema: string) => {
      // Prevent duplicate provisioning
      if (hasProvisionedRef.current.has(docId)) {
        return
      }

      setIsProvisioning(true)
      setProvisioningError(null)
      hasProvisionedRef.current.add(docId)

      try {
        console.log('🔧 Auto-provisioning translation metadata for:', {
          documentId: docId,
          language: lang,
          schemaType: schema,
        })

        // Double-check metadata doesn't exist
        const existingMetadata = await client.fetch(METADATA_EXISTS_QUERY, {
          docId: getPublishedId(docId),
        })

        if (existingMetadata) {
          console.log('✅ Metadata already exists, skipping')
          return
        }

        // Create the metadata document
        const metadataDocument = buildMetadataDocument(docId, lang, schema)

        await client.create(metadataDocument)

        console.log('✅ Translation metadata auto-provisioned successfully')
      } catch (error) {
        console.error('❌ Failed to auto-provision metadata:', error)
        setProvisioningError(error instanceof Error ? error.message : 'Unknown error')
        // Remove from set so it can be retried
        hasProvisionedRef.current.delete(docId)
      } finally {
        setIsProvisioning(false)
      }
    },
    [client],
  )

  // Auto-provision when conditions are met
  useEffect(() => {
    if (
      documentId &&
      language &&
      hasMetadata === false &&
      !isProvisioning &&
      !hasProvisionedRef.current.has(documentId)
    ) {
      provisionMetadata(documentId, language, schemaType)
    }
  }, [documentId, language, hasMetadata, isProvisioning, schemaType, provisionMetadata])

  return {
    isProvisioning,
    provisioningError,
  }
}
