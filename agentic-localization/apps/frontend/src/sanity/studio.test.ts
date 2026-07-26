import {describe, expect, it} from 'vitest'

import type {Preview} from './live'
import {editRegion, STUDIO_URL} from './studio'

const DRAFT: Preview = {perspective: 'drafts', stega: true}
const PUBLISHED: Preview = {perspective: 'published', stega: false}

const article = {_id: 'drafts.article-1', _type: 'article'}

describe('editRegion', () => {
  it('names the document, the field and the Studio the overlay opens', () => {
    expect(editRegion(DRAFT, article, 'title')).toBe(
      `id=article-1;type=article;path=title;base=${encodeURIComponent(STUDIO_URL)}`,
    )
  })

  it('leaves published HTML free of editing metadata', () => {
    expect(editRegion(PUBLISHED, article, 'title')).toBeUndefined()
  })
})
