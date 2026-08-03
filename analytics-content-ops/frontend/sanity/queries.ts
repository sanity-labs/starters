import {defineQuery} from 'next-sanity'

// Card projection shared across listings. `readingTimeMinutes` is derived from
// the body so listings don't need to over-fetch.
const cardFields = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  "dek": excerpt,
  "date": publishedAt,
  "category": category->title,
  "authors": authors[]->name,
  "image": mainImage,
  "readingTimeMinutes": round(length(pt::text(body)) / 1100)
`

export const ARTICLES_QUERY = defineQuery(`
  *[_type == "article" && defined(slug.current)] | order(publishedAt desc) {
    ${cardFields}
  }
`)

// Content-intelligence feature #1: a "Trending" rail powered entirely by the
// synced analytics signal — no separate analytics integration. When the nightly
// sync updates tiers, this rail updates automatically.
export const TRENDING_QUERY = defineQuery(`
  *[_type == "articlePerformance" && performanceTier == "trending"]
  | order(catalogPercentile desc)[0...6] {
    "article": article->{ ${cardFields} }
  }
`)

// Content-intelligence feature #2: "Most read", ranked by catalog percentile
// across every scored article.
export const MOST_READ_QUERY = defineQuery(`
  *[_type == "articlePerformance" && defined(catalogPercentile)]
  | order(catalogPercentile desc)[0...5] {
    "article": article->{ ${cardFields} },
    catalogPercentile
  }
`)

export const ARTICLE_QUERY = defineQuery(`
  *[_type == "article" && slug.current == $slug][0] {
    ${cardFields},
    body,
    sourceUrl,
    seoTitle,
    seoDescription
  }
`)

export const RELATED_QUERY = defineQuery(`
  *[_type == "article" && defined(slug.current) && slug.current != $slug]
  | order(publishedAt desc)[0...3] {
    ${cardFields}
  }
`)

export const ARTICLE_SLUGS_QUERY = defineQuery(`
  *[_type == "article" && defined(slug.current)] { "slug": slug.current }
`)
