import {Tab, TabList} from '@sanity/ui'

import {useApp} from '../../contexts/AppContext'

export const documentTypeLabels: Record<string, string> = {
  article: 'Articles',
}
export default function DocumentTypeSelector() {
  const {selectedDocumentType, setSelectedDocumentType, supportedTypes} = useApp()

  return (
    <div className="bg-white px-4 pb-2 border-b border-gray-200 sticky top-0 z-10 flex justify-center">
      <TabList space={2}>
        {supportedTypes.map((type) => (
          <Tab
            aria-controls={`${type}-panel`}
            id={`${type}-tab`}
            key={type}
            label={documentTypeLabels[type] || type}
            onClick={() => setSelectedDocumentType(type)}
            selected={selectedDocumentType === type}
          />
        ))}
      </TabList>
    </div>
  )
}
