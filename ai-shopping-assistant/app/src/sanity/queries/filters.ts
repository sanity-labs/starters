// All filter options in a single query for efficiency
export const FILTER_OPTIONS_QUERY = /* groq */ `{
  "categories": *[_type == "category" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current
  },
  "colors": *[_type == "color" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    hexValue
  },
  "sizes": *[_type == "size"] | order(sortOrder asc) {
    _id,
    title,
    code,
    sortOrder
  },
  "brands": *[_type == "brand" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current
  },
  "priceRange": {
    "min": math::min(*[_type == "product" && defined(price.amount)].price.amount),
    "max": math::max(*[_type == "product" && defined(price.amount)].price.amount)
  }
}`
