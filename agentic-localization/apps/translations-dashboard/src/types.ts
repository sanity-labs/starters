import type {KeyedObject, Reference} from 'sanity'

export type TranslationReference = {
  _type: 'internationalizedArrayReferenceValue'
  value: Reference
} & KeyedObject
