import {createContext, type ReactNode, useCallback, useContext, useState} from 'react'

export type TranslationProgressContextType = {
  batchTranslationStatus: {message?: string; success?: boolean} | null
  clearCreationStatus: () => void
  clearTranslationProgress: () => void
  creationStatus: {message?: string; success?: boolean} | null
  isBatchTranslating: boolean
  isCreating: boolean
  setBatchTranslationStatus: (status: {message?: string; success?: boolean} | null) => void
  setCreationStatus: (status: {message?: string; success?: boolean} | null) => void
  setIsBatchTranslating: (translating: boolean) => void
  setIsCreating: (isCreating: boolean) => void
  setTranslationDocumentId: (id: null | string) => void
  setTranslationProgress: (progress: TranslationProgress) => void
  translationDocumentId: null | string
  translationProgress: TranslationProgress
}

type TranslationProgress = {
  current: number
  status: 'created' | 'creating' | 'skipped'
  subProgress?: number
  total: number
} | null

const TranslationProgressContext = createContext<TranslationProgressContextType | undefined>(
  undefined,
)

interface TranslationProgressProviderProps {
  children: ReactNode
}

export function TranslationProgressProvider({children}: TranslationProgressProviderProps) {
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [creationStatus, setCreationStatus] = useState<{
    message?: string
    success?: boolean
  } | null>(null)
  const [translationDocumentId, setTranslationDocumentId] = useState<null | string>(null)

  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [batchTranslationStatus, setBatchTranslationStatus] = useState<{
    message?: string
    success?: boolean
  } | null>(null)

  const clearTranslationProgress = useCallback(() => {
    setTranslationProgress(null)
  }, [])

  const clearCreationStatus = useCallback(() => {
    setCreationStatus(null)
  }, [])

  const value: TranslationProgressContextType = {
    batchTranslationStatus,
    clearCreationStatus,
    clearTranslationProgress,
    creationStatus,
    isBatchTranslating,
    isCreating,
    setBatchTranslationStatus,
    setCreationStatus,
    setIsBatchTranslating,
    setIsCreating,
    setTranslationDocumentId,
    setTranslationProgress,
    translationDocumentId,
    translationProgress,
  }

  return (
    <TranslationProgressContext.Provider value={value}>
      {children}
    </TranslationProgressContext.Provider>
  )
}

export function useTranslationProgress(): TranslationProgressContextType {
  const context = useContext(TranslationProgressContext)
  if (context === undefined) {
    throw new Error('useTranslationProgress must be used within a TranslationProgressProvider')
  }
  return context
}
