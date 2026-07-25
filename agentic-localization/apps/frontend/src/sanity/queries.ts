import {defineQuery} from 'next-sanity'

export const DEFAULT_LANGUAGE = 'en-US'

const ARTICLE_CARD_FIELDS = `_id, title, "slug": slug.current, excerpt, publishedAt, language`
const ARTICLE_DETAIL_FIELDS = `${ARTICLE_CARD_FIELDS}, body, "author": author->{ name }`

const LOCALE_FIELDS = `code, title, nativeName, "fallback": fallback->code`

/**
 * Every locale this document is published in, reached through the
 * `translation.metadata` join. Slugs differ per locale, so this is the only
 * honest way to build a cross-locale link — matching one locale's slug against
 * another's is the bug it exists to prevent.
 */
const SIBLING_TRANSLATIONS = `*[_type == "translation.metadata" && references(^._id)][0]
    .translations[defined(value->slug.current)].value->{"language": language, "slug": slug.current}`

export const LOCALES_QUERY = defineQuery(
  `*[_type == "l10n.locale"] | order(title asc) { ${LOCALE_FIELDS} }`,
)

export const ARTICLES_BY_LANGUAGE_QUERY = defineQuery(
  `*[_type == "article" && language == $language] | order(publishedAt desc) { ${ARTICLE_CARD_FIELDS} }`,
)

export const ARTICLE_SLUGS_QUERY = defineQuery(
  `*[_type == "article" && language == $language && defined(slug.current)] { "slug": slug.current }`,
)

/**
 * A slug belongs to one locale, so `$language` orders the candidates rather
 * than filtering them: the requested locale wins when it owns the slug, and
 * whichever locale does own it answers otherwise — carrying the siblings and
 * the locale fallback graph needed to decide what to render.
 */
export const ARTICLE_QUERY = defineQuery(
  `*[_type == "article" && slug.current == $slug] | order(select(language == $language => 0, 1) asc)[0] {
    ${ARTICLE_DETAIL_FIELDS},
    "translations": ${SIBLING_TRANSLATIONS},
    "locales": *[_type == "l10n.locale"] | order(title asc) { ${LOCALE_FIELDS} }
  }`,
)

export const SITEMAP_QUERY = defineQuery(
  `*[_type == "article" && defined(slug.current) && defined(language)] {
    "language": language, "slug": slug.current, _updatedAt,
    "translations": ${SIBLING_TRANSLATIONS}
  }`,
)
