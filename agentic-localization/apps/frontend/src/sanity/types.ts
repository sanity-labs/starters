import type {ComponentProps} from 'react'
import type {PortableText} from '@portabletext/react'
import {
  ARTICLE_QUERY,
  ARTICLE_SLUGS_QUERY,
  ARTICLES_BY_LANGUAGE_QUERY,
  LOCALES_QUERY,
  SITEMAP_QUERY,
} from './queries'

type PortableTextValue = ComponentProps<typeof PortableText>['value']

export interface Locale {
  code: string
  title: string
  nativeName: string | null
  /** Locale to try when this one has no translation. Chains, so walk it. */
  fallback: string | null
}

/** One locale's rendition of a document: its own language, its own slug. */
export interface Translation {
  language: string
  slug: string
}

export interface ArticleCard {
  _id: string
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  language: string
}

export interface ArticleDetail extends ArticleCard {
  body: PortableTextValue | null
  author: {name: string} | null
}

export interface ArticleResolution extends ArticleDetail {
  translations: Translation[] | null
  locales: Locale[]
}

export interface SitemapEntry {
  language: string
  slug: string
  _updatedAt: string
  translations: Translation[] | null
}

/**
 * This app sits outside the Studio's TypeGen glob so it stays a plain Next app
 * you can lift out. Augmenting `SanityQueries` by query string gives
 * `sanityFetch` the typed `data` TypeGen would, with no casts at the call sites.
 */
declare module '@sanity/client' {
  interface SanityQueries
    extends
      Record<typeof LOCALES_QUERY, Locale[]>,
      Record<typeof ARTICLES_BY_LANGUAGE_QUERY, ArticleCard[]>,
      Record<typeof ARTICLE_SLUGS_QUERY, Array<{slug: string}>>,
      Record<typeof ARTICLE_QUERY, ArticleResolution | null>,
      Record<typeof SITEMAP_QUERY, SitemapEntry[]> {}
}
