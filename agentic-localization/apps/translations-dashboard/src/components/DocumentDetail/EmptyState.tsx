import {InfoOutlineIcon} from '@sanity/icons'
import {Card, Heading} from '@sanity/ui'

const EmptyState = ({
  isBatchMode = false,
  selectedDocumentType,
}: {
  isBatchMode?: boolean
  selectedDocumentType: string
}) => {
  const firstChar = selectedDocumentType?.charAt(0)?.toLowerCase() || ''
  const isVowel = firstChar && ['a', 'e', 'i', 'o', 'u'].includes(firstChar)
  const article = isVowel ? 'an' : 'a'

  if (isBatchMode) {
    return (
      <Card className="w-96" padding={5} tone="suggest">
        <div className="flex flex-col gap-4 items-center">
          <InfoOutlineIcon className="text-5xl" />
          <Heading as="h2" className="text-center text-pretty">
            Select multiple <span className="lowercase">{selectedDocumentType}s</span> to view their
            translation status and start translating.
          </Heading>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-96" padding={5} tone="suggest">
      <div className="flex flex-col gap-4 items-center">
        <InfoOutlineIcon className="text-5xl" />
        <Heading as="h2" className="text-center text-pretty">
          Select {article} <span className="lowercase">{selectedDocumentType}</span> to manage the
          translation status of the document.
        </Heading>
      </div>
    </Card>
  )
}

export default EmptyState
