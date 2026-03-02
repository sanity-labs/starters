import {getPublishedId} from 'sanity'

import type {TranslationReference} from '../types'

export function createReference(
  key: string,
  ref: string,
  type: string,
  strengthenOnPublish: boolean = false,
): TranslationReference {
  return {
    _key: key,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _ref: getPublishedId(ref),
      _type: 'reference',
      _weak: true,
      // If the user has configured weakReferences, we won't want to strengthen them
      ...(strengthenOnPublish ? {_strengthenOnPublish: {type}} : {}),
    },
  }
}
