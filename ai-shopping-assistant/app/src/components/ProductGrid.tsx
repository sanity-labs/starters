import {ProductCard} from './ProductCard'

interface ProductGridProduct {
  _id: string
  title: string | null
  slug: string | null
  shortDescription?: string | null
  category?: {_id: string; title: string | null; slug: string | null} | null
  brand?: {_id: string; title: string | null; slug: string | null} | null
  image?: {
    asset?: {_id: string; url: string | null; metadata?: {lqip?: string | null} | null} | null
    alt?: string | null
  } | null
  price?: {amount?: number | null; compareAtPrice?: number | null} | null
}

interface ProductGridProps {
  products: ProductGridProduct[]
}

export function ProductGrid({products}: ProductGridProps) {
  if (!products.length) {
    return <div className="py-12 text-center text-neutral-500">No products found.</div>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  )
}
