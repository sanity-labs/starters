import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'

import type {Preview} from '@/sanity/live'
import type {ArticleCard as ArticleCardType} from '@/sanity/types'
import {ArticleCard} from './ArticleCard'

const article: ArticleCardType = {
  _id: 'drafts.article-1',
  _type: 'article',
  title: 'Structured metadata',
  slug: 'structured-metadata',
  excerpt: null,
  publishedAt: null,
  language: 'en-US',
}

function render(preview: Preview): string {
  return renderToStaticMarkup(<ArticleCard article={article} lang="en-US" preview={preview} />)
}

describe('ArticleCard', () => {
  it('makes the whole card one edit region in draft mode', () => {
    expect(render({perspective: 'drafts', stega: true})).toContain(
      'data-sanity="id=article-1;type=article;path=title',
    )
  })

  it('ships no editing metadata to a visitor', () => {
    expect(render({perspective: 'published', stega: false})).not.toContain('data-sanity')
  })
})
