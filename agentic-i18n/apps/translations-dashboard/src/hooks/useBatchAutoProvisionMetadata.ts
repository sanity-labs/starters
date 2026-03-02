import {useClient} from '@sanity/sdk-react'
import {useCallback} from 'react'
import {getPublishedId} from 'sanity'

import {useApp} from '../contexts/AppContext'
import {buildMetadataDocument, METADATA_EXISTS_QUERY} from '../lib/metadata'

type DocumentToProvision = {
  _id: string
  language: string
  schemaType: string
}

/**
 * Hook that automatically provisions translation metadata for multiple documents
 * that have a language set but no metadata yet
 */
export const useBatchAutoProvisionMetadata = () => {
  const {sanityClientConfig} = useApp()
  const client = useClient(sanityClientConfig)

  const provisionMetadataForDocuments = useCallback(
    async (
      documents: DocumentToProvision[],
    ): Promise<{failedIds: string[]; successIds: string[]}> => {
      const successIds: string[] = []
      const failedIds: string[] = []

      console.log(`🔧 Batch auto-provisioning metadata for ${documents.length} documents`)

      for (const doc of documents) {
        try {
          // Double-check metadata doesn't exist
          const existingMetadata = await client.fetch(METADATA_EXISTS_QUERY, {
            docId: getPublishedId(doc._id),
          })

          if (existingMetadata) {
            console.log(`✅ Metadata already exists for ${doc._id}, skipping`)
            successIds.push(doc._id)
            continue
          }

          // Create the metadata document
          const metadataDocument = buildMetadataDocument(doc._id, doc.language, doc.schemaType)

          await client.create(metadataDocument)
          successIds.push(doc._id)

          console.log(`✅ Auto-provisioned metadata for ${doc._id}`)
        } catch (error) {
          console.error(`❌ Failed to auto-provision metadata for ${doc._id}:`, error)
          failedIds.push(doc._id)
        }
      }

      console.log(
        `✅ Batch auto-provisioning complete: ${successIds.length} succeeded, ${failedIds.length} failed`,
      )

      return {failedIds, successIds}
    },
    [client],
  )

  return {
    provisionMetadataForDocuments,
  }
}
