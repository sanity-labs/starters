import {describe, expect, it} from 'vitest'

import {buildEditIntent} from './editIntent'

describe('buildEditIntent', () => {
  it('carries no perspective when the run writes into a draft', () => {
    expect(buildEditIntent({documentId: 'article-1'}, 'article')).toEqual({
      params: {id: 'article-1', type: 'article'},
      searchParams: [],
    })
  })

  it('opens the document in the release the run writes into', () => {
    expect(
      buildEditIntent({documentId: 'versions.summer.article-1', releaseName: 'summer'}, 'article'),
    ).toEqual({
      params: {id: 'article-1', type: 'article'},
      searchParams: [['perspective', 'summer']],
    })
  })

  it('resolves drafts and versions to the published id the intent expects', () => {
    expect(buildEditIntent({documentId: 'drafts.article-1'}, 'article').params.id).toBe('article-1')
    expect(buildEditIntent({documentId: 'versions.summer.article-1'}, 'article').params.id).toBe(
      'article-1',
    )
  })

  it('turns a field name into the path that focuses the editor on it', () => {
    expect(
      buildEditIntent(
        {documentId: 'article-1', fieldName: 'title', releaseName: 'summer'},
        'article',
      ),
    ).toEqual({
      params: {id: 'article-1', type: 'article', path: 'title'},
      searchParams: [['perspective', 'summer']],
    })
  })
})
