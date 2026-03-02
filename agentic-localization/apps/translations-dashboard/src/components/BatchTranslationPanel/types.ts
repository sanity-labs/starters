import type {SanityDocument} from 'sanity'

export type BatchProcessState =
  | 'COMPLETE'
  | 'LOCALES_SET_COMPLETE'
  | 'READY_TO_SET_LOCALES'
  | 'READY_TO_TRANSLATE'
  | 'SELECTING'
  | 'SETTING_LOCALES'
  | 'TRANSLATING'
  | 'VALIDATING'

export type BatchTranslationStatus = {
  message?: string
  success?: boolean
}

export type BulkLanguageProgress = {
  current: number
  currentDocId?: string
  total: number
}

export type DocumentTranslationProgress = {
  currentlyTranslating?: string
  translations: TranslationStatus[]
}

export type DocumentValidationStatus = {
  _translationStatus?: string
  hasMetadata: boolean
  language: null | string
  title?: string
} & SanityDocument

export type EnhancedDocument = {
  _existingTranslations?: Translation[]
  _summaryCount?: TranslationSummaryCounts
  _translationsByLanguage?: Record<string, LanguageTranslationStatus>
} & DocumentValidationStatus

export type Language = {
  fallbackLocale?: null | string
  id: string
  releaseId?: string
  title: string
}

export type LanguageTranslationStatus = {
  hasTranslation: boolean
  isInRelease: boolean
  isLocked: boolean
  languageId: string
  languageTitle: string
  releaseName?: string
  status: 'completed' | 'fallback' | 'missing'
  translatedDocumentId?: string
  translatedDocumentTitle?: string
  workflowStatus?: 'approved' | 'missing' | 'needsReview' | 'stale' | 'usingFallback'
}

export type Translation = {
  language: null | string
  title: null | string
} & Pick<SanityDocument, '_id'>

export type TranslationStatus = {
  languageId: string
  languageTitle: string
  releaseName?: string
  status: 'created' | 'creating' | 'failed' | 'pending'
  translatedDocumentId?: string
}

export type TranslationSummaryCounts = {
  fallback: number
  inRelease: number
  missing: number
  translated: number
}
