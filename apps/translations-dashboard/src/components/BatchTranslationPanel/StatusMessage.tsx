import {Card, Text} from '@sanity/ui'
import type {SanityDocument} from 'sanity'

type StatusMessageProps = {
  batchTranslationStatus: {message?: string; success?: boolean} | null
  canTranslate: boolean
  fullyTranslatedDocuments: SanityDocument[]
  hasValidReleaseSelected: boolean
  hasWorkToDo: boolean
  invalidDocuments: SanityDocument[]
}

const StatusMessage = ({
  batchTranslationStatus,
  canTranslate,
  fullyTranslatedDocuments,
  hasValidReleaseSelected,
  hasWorkToDo,
  invalidDocuments,
}: StatusMessageProps) => {
  const getMessage = () => {
    if (invalidDocuments.length > 0) {
      return 'All documents must have a base language set before batch translation can proceed. Click on documents without base languages to configure them.'
    }
    if (!hasValidReleaseSelected && invalidDocuments.length === 0) {
      return 'Please select a release to create translations. All translations will be added to the selected release instead of being published immediately. Note: You cannot use "Published" for batch translations.'
    }
    if (!hasWorkToDo && fullyTranslatedDocuments.length > 0) {
      return 'All selected documents are already fully translated. No work needed.'
    }
    if (canTranslate && hasWorkToDo) {
      if (fullyTranslatedDocuments.length > 0) {
        return 'This will create missing translations for documents that need them. Fully translated documents will be automatically skipped.'
      }
      return 'This will create missing translations for all selected documents based on their existing content and available languages.'
    }
    return 'Select documents to enable batch translation.'
  }

  return (
    <>
      {batchTranslationStatus && (
        <Card
          padding={3}
          radius={1}
          tone={
            batchTranslationStatus.success === false
              ? 'critical'
              : batchTranslationStatus.success === true
                ? 'positive'
                : 'default'
          }
        >
          <Text size={1}>{batchTranslationStatus.message}</Text>
        </Card>
      )}

      <Text muted size={0}>
        {getMessage()}
      </Text>
    </>
  )
}

export default StatusMessage
