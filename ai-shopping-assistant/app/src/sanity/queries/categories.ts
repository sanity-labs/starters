// All categories
export const CATEGORIES_QUERY = /* groq */ `
  *[_type == "category" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    description
  }
`

// Single category
export const CATEGORY_QUERY = /* groq */ `
  *[_type == "category" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    description
  }
`
