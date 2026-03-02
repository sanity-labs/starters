import {CloseIcon} from '@sanity/icons'
import {Button, Flex, Heading} from '@sanity/ui'

type PostHeaderProps = {
  documentId: string
  language: null | string
  onClose: () => void
  title: null | string
}

const Header = ({documentId, language, onClose, title}: PostHeaderProps) => {
  return (
    <Flex align="flex-start" gap={2} justify="flex-start">
      {/* Flex wrapper for title and document ID etc*/}
      <Flex align="flex-start" className=" w-full" direction="column" gap={1} justify="flex-start">
        <Flex align="center" className="w-full" gap={1} justify="space-between">
          {/* Title */}
          <Heading align="center" className="text-pretty" size={2}>
            <strong>{typeof title === 'string' ? title : 'Untitled'}</strong>
          </Heading>

          <Button fontSize={1} icon={CloseIcon} mode="bleed" onClick={onClose} padding={2} />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default Header
