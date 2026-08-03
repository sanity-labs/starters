import {defineQuery} from 'groq'

/**
 * Two-tier query strategy:
 *
 * Filters stay on indexed fields (_type, slug.current, _ref); the
 * section lookup runs as a subquery instead of a -> join in the filter.
 * - Navigation routes (sections, sitemap, llms.txt) fetch titles, slugs,
 *   and summaries only. Small responses, long cache.
 * - Article routes fetch full content. One article per request.
 */

export const ARTICLE_WITH_NAV_QUERY = defineQuery(`{
  "article": *[_type == "article" && slug.current == $articleSlug && section._ref in *[_type == "section" && slug.current == $sectionSlug]._id][0] {
    _id,
    title,
    slug,
    summary,
    content,
    "section": section-> {
      _id,
      title,
      slug
    }
  },
  "allArticles": *[_type == "article" && section._ref in *[_type == "section" && slug.current == $sectionSlug]._id] | order(order asc) {
    _id,
    title,
    slug,
    order
  }
}`)

export const SECTION_QUERY = defineQuery(`*[_type == "section" && slug.current == $sectionSlug][0] {
  _id,
  title,
  slug,
  description,
  "articles": *[_type == "article" && section._ref == ^._id] | order(order asc) {
    _id,
    title,
    slug,
    summary
  }
}`)

export const SITEMAP_QUERY = defineQuery(`*[_type == "section"] | order(order asc) {
  _id,
  title,
  slug,
  description,
  "articles": *[_type == "article" && section._ref == ^._id] | order(order asc) {
    _id,
    title,
    slug,
    summary
  }
}`)

export const SECTION_SLUGS_QUERY = defineQuery(
  `*[_type == "section"] | order(order asc) { "slug": slug.current }`,
)

export const ARTICLE_SLUGS_QUERY = defineQuery(
  `*[_type == "article"] { "article": slug.current, "section": section->slug.current }`,
)
