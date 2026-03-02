import {type ProductFiltersInput} from '@/lib/client-tools'

import {
  brandFragment,
  categoryFragment,
  imageFragment,
  priceFragment,
  variantFragment,
} from './fragments'

// Product card fragment for consistent field selection (internal)
const productCardFragment = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  shortDescription,
  "category": category->{ ${categoryFragment} },
  "brand": brand->{ ${brandFragment} },
  "image": variants[0].images[0] { ${imageFragment} },
  price { ${priceFragment} }
`

// Product card data (for grids/listings)
export const PRODUCTS_QUERY = /* groq */ `
  *[_type == "product" && defined(slug.current)] | order(_createdAt desc) {
    ${productCardFragment}
  }
`

// Featured products for homepage (limited)
export const FEATURED_PRODUCTS_QUERY = /* groq */ `
  *[_type == "product" && defined(slug.current)] | order(_createdAt desc) [0...12] {
    ${productCardFragment}
  }
`

// Single product with full details
export const PRODUCT_QUERY = /* groq */ `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    sku,
    shortDescription,
    description,
    features,
    careInstructions,
    "category": category->{ ${categoryFragment} },
    "brand": brand->{ ${brandFragment} },
    price { ${priceFragment} },
    "materials": materials[]->{ _id, title },
    "variants": variants[] { ${variantFragment} }
  }
`

// Product slugs for static generation
export const PRODUCT_SLUGS_QUERY = /* groq */ `
  *[_type == "product" && defined(slug.current)] {
    "slug": slug.current
  }
`

// Multiple of 4 for grid layout
export const PAGE_SIZE = 48

// Sort options configuration
export const SORT_OPTIONS = [
  {value: 'newest', label: 'Newest'},
  {value: 'price-asc', label: 'Price: Low to High'},
  {value: 'price-desc', label: 'Price: High to Low'},
  {value: 'title-asc', label: 'Name: A to Z'},
] as const

// Build a GROQ filter string from ProductFilters.
// Color and size filters use count() to check if ANY variant matches,
// since variants are nested arrays (variant -> colors/sizes).
function buildProductFilterConditions(filters: ProductFiltersInput): string[] {
  const conditions: string[] = ['_type == "product"', 'defined(slug.current)']

  if (filters.category?.length) {
    const slugs = filters.category.map((s) => `"${s}"`).join(', ')
    conditions.push(`category->slug.current in [${slugs}]`)
  }

  if (filters.brand?.length) {
    const slugs = filters.brand.map((s) => `"${s}"`).join(', ')
    conditions.push(`brand->slug.current in [${slugs}]`)
  }

  if (filters.color?.length) {
    const slugs = filters.color.map((s) => `"${s}"`).join(', ')
    conditions.push(`count(variants[color->slug.current in [${slugs}]]) > 0`)
  }

  if (filters.size?.length) {
    const codes = filters.size.map((s) => `"${s}"`).join(', ')
    conditions.push(`count(variants[count(sizes[@->code in [${codes}]]) > 0]) > 0`)
  }

  if (filters.minPrice !== undefined) {
    conditions.push(`price.amount >= ${filters.minPrice}`)
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`price.amount <= ${filters.maxPrice}`)
  }

  return conditions
}

// Build the order clause from sort option
function buildProductSortClause(sort?: ProductFiltersInput['sort']): string {
  switch (sort) {
    case 'price-asc':
      return 'order(price.amount asc)'
    case 'price-desc':
      return 'order(price.amount desc)'
    case 'title-asc':
      return 'order(title asc)'
    case 'newest':
    default:
      return 'order(_createdAt desc)'
  }
}

// Build the complete filtered products query string
export function buildFilteredProductsQuery(
  filters: ProductFiltersInput,
  pageSize: number = PAGE_SIZE,
): string {
  const conditions = buildProductFilterConditions(filters)
  const sortClause = buildProductSortClause(filters.sort)

  return /* groq */ `
    *[${conditions.join(' && ')}] | ${sortClause} [($page - 1) * ${pageSize}...$page * ${pageSize}] {
      ${productCardFragment}
    }
  `
}

// Build the count query for filtered products
export function buildFilteredProductsCountQuery(filters: ProductFiltersInput): string {
  const conditions = buildProductFilterConditions(filters)
  return /* groq */ `count(*[${conditions.join(' && ')}])`
}
