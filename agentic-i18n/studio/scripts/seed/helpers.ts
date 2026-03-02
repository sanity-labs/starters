import {getPublishedId, type Reference} from 'sanity'

export function ref(id: string) {
  return {_type: 'reference', _ref: getPublishedId(id)} satisfies Reference
}

export function weakRef(id: string, type: string) {
  return {
    _type: 'reference',
    _ref: getPublishedId(id),
    _weak: true,
    _strengthenOnPublish: {type},
  } satisfies Reference
}
