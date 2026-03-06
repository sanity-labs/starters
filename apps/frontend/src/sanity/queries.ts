import {defineQuery} from 'next-sanity'

export const DEFAULT_LANGUAGE = 'en-US'

export const LOCALES_QUERY = defineQuery(
  `*[_type == "l10n.locale"] | order(title asc) { code, title, nativeName }`,
)

export const ARTICLES_BY_LANGUAGE_QUERY = defineQuery(
  `*[_type == "article" && language == $language] | order(publishedAt desc) { _id, title, "slug": slug.current, excerpt, publishedAt, language, mainImage }`,
)

export const ARTICLE_BY_SLUG_QUERY = defineQuery(
  `*[_type == "article" && slug.current == $slug && language == $language][0] { _id, title, "slug": slug.current, excerpt, publishedAt, language, body, mainImage, "author": author->{ name } }`,
)

export const ARTICLE_FALLBACK_QUERY = defineQuery(
  `*[_type == "article" && slug.current == $slug && language == $fallbackLanguage][0] { _id, title, "slug": slug.current, excerpt, publishedAt, language, body, mainImage, "author": author->{ name } }`,
)
