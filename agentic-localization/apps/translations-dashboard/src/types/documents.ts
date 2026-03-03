import type {KeyedObject} from 'sanity'

export interface BaseDocument {
  _createdAt?: string
  _id: string
  _type: string
  language: null | string
  title: null | string
}

export interface DocumentDetailData {
  _createdAt?: string
  _hasMetadata?: boolean
  _id: string
  _releaseTranslations?: ReleaseTranslation[]
  _translationMetadataId?: string[]
  _translations: TranslationDocument[]
  _translationStatus: 'fully translated' | 'none' | 'partial' | null
  language: null | string
  title: null | string
}

export interface ReleaseTranslation extends KeyedObject {
  published?: null | TranslationDocument
  publishedId: string
  version?: null | TranslationDocument
  versionId: string
}

export interface TranslationData {
  _id: string
  _translations: TranslationDocument[]
}

export interface TranslationDocument extends BaseDocument {
  slug?: {
    current?: string
    fullUrl?: string
  }
}
