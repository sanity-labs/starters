import {type DocumentHandle} from '@sanity/sdk'
import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useState,
} from 'react'

export type SelectionContextType = {
  clearSelection: () => void
  isBatchMode: boolean
  selectedDocuments: string[]
  selectedDocumentType: string
  selectedPost: DocumentHandle | null
  selectedType: DocumentHandle | null
  setIsBatchMode: (mode: boolean) => void
  setSelectedDocuments: (documents: string[]) => void
  setSelectedDocumentType: (type: string) => void
  setSelectedPost: (post: DocumentHandle | null) => void
  setStatus: (status: null | Status) => void
  status: null | Status
  toggleDocumentSelection: (documentId: string) => void
  updateSelectedType: (handle: DocumentHandle | null) => void
}

type Status = 'all' | 'fully-translated' | 'partially-translated' | 'untranslated'

const SelectionContext = createContext<SelectionContextType | undefined>(undefined)

interface SelectionProviderProps {
  children: ReactNode
  initialDocumentType: string
}

export function SelectionProvider({children, initialDocumentType}: SelectionProviderProps) {
  const [selectedType, setSelectedType] = useState<DocumentHandle | null>(null)
  const updateSelectedType = (handle: DocumentHandle | null) =>
    startTransition(() => setSelectedType(handle))

  const [status, setStatus] = useState<null | Status>('all')
  const [selectedPost, setSelectedPost] = useState<DocumentHandle | null>(null)
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>(initialDocumentType)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)

  const toggleDocumentSelection = useCallback((documentId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDocuments([])
  }, [])

  const value: SelectionContextType = {
    clearSelection,
    isBatchMode,
    selectedDocuments,
    selectedDocumentType,
    selectedPost,
    selectedType,
    setIsBatchMode,
    setSelectedDocuments,
    setSelectedDocumentType,
    setSelectedPost,
    setStatus,
    status,
    toggleDocumentSelection,
    updateSelectedType,
  }

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext)
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}
