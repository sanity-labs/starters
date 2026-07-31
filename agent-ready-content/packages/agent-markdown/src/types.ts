import type {PortableTextBlock} from '@portabletext/types'
import type {
  ARTICLE_WITH_NAV_QUERY_RESULT,
  SECTION_QUERY_RESULT,
  SITEMAP_QUERY_RESULT,
} from './sanity.types'

/**
 * Builder input types, derived from the generated query result types
 * in sanity.types.ts (created by `pnpm typegen`). Change a query or
 * the schema, rerun typegen, and the builders flag the drift at
 * compile time.
 */

export type ArticleWithNav = ARTICLE_WITH_NAV_QUERY_RESULT
export type Article = NonNullable<ARTICLE_WITH_NAV_QUERY_RESULT['article']>
export type ArticleRef = ARTICLE_WITH_NAV_QUERY_RESULT['allArticles'][number]
export type SectionListing = NonNullable<SECTION_QUERY_RESULT>
export type SitemapSection = SITEMAP_QUERY_RESULT[number]

/** Value shapes the custom block renderers receive. */
export type CodeBlock = {
  _type: 'code'
  language?: string
  filename?: string
  code: string
}

export type ImageBlock = {
  _type: 'image'
  asset: {_ref: string}
  alt?: string
  caption?: string
}

export type CalloutBlock = {
  _type: 'callout'
  style?: 'note' | 'tip' | 'important' | 'warning' | 'caution'
  content: PortableTextBlock[]
}

export type SiteInfo = {
  title: string
  summary: string
  url: string
}

export type ArticleMarkdownOptions = {
  canonicalUrl: string
  prevArticle?: ArticleRef
  nextArticle?: ArticleRef
}
