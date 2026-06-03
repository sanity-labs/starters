import '@starter/sanity-types'

import {defineQuery} from 'next-sanity'

// Browse, optionally filtered by a product and/or topic slug. Pass null to skip
// a filter. Only published external content is shown.
export const articlesQuery = defineQuery(`
  *[
    _type == "helpArticle" && status == "published" && defined(slug.current)
    && ($product == null || $product in products[]->slug.current)
    && ($topic == null || $topic in topics[]->slug.current)
  ] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    summary,
    "products": products[]->{ _id, title, "slug": slug.current },
    "topics": topics[]->{ _id, title, "slug": slug.current },
  }
`)

export const articleQuery = defineQuery(`
  *[_type == "helpArticle" && slug.current == $slug] [0] {
    _id,
    title,
    "slug": slug.current,
    summary,
    content,
    "products": products[]->{ _id, title, "slug": slug.current },
    "topics": topics[]->{ _id, title, "slug": slug.current },
  }
`)

export const articleSlugsQuery = defineQuery(`
  *[_type == "helpArticle" && defined(slug.current)]
  {"slug": slug.current}
`)

export const productsQuery = defineQuery(`
  *[_type == "product"] | order(title asc) { _id, title, "slug": slug.current }
`)

export const topicsQuery = defineQuery(`
  *[_type == "topic"] | order(title asc) { _id, title, "slug": slug.current }
`)
