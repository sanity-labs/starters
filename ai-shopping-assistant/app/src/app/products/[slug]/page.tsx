import Link from 'next/link'
import {notFound} from 'next/navigation'
import type {Metadata} from 'next/types'

import {ProductDetails} from '@/components/ProductDetails'
import {client} from '@/sanity/lib/client'
import {PRODUCT_QUERY, PRODUCT_SLUGS_QUERY} from '@/sanity/queries'

interface Props {
  params: Promise<{slug: string}>
}

interface ProductResult {
  _id: string
  title: string | null
  slug: string | null
  sku?: string | null
  shortDescription?: string | null
  description?: string | null
  features?: string[] | null
  careInstructions?: string | null
  category?: {_id: string; title: string | null; slug: string | null} | null
  brand?: {_id: string; title: string | null; slug: string | null} | null
  price?: {amount?: number | null; compareAtPrice?: number | null} | null
  materials?: {_id: string; title: string | null}[] | null
  variants?: Array<{
    _key: string | null
    sku?: string | null
    available?: boolean | null
    color?: {_id: string; title: string | null; hex?: string | null} | null
    sizes?: Array<{_id: string; title: string | null; code: string | null; sortOrder?: number | null}> | null
    images?: Array<{
      asset?: {_id: string; url: string | null; metadata?: {lqip?: string | null} | null} | null
      alt?: string | null
    }> | null
  }> | null
}

export async function generateStaticParams() {
  const products: Array<{slug: string | null}> = await client.fetch(PRODUCT_SLUGS_QUERY)
  return products.filter((p) => p.slug).map((p) => ({slug: p.slug!}))
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug} = await params
  const product: ProductResult | null = await client.fetch(PRODUCT_QUERY, {slug})
  if (!product) return {title: 'Product Not Found'}
  return {
    title: `${product.title} | Store`,
    description: product.shortDescription || `Shop ${product.title}`,
  }
}

export default async function ProductPage({params}: Props) {
  const {slug} = await params
  const product: ProductResult | null = await client.fetch(PRODUCT_QUERY, {slug})

  if (!product) {
    notFound()
  }

  const {title, price, category, shortDescription, features, materials, variants, brand} = product

  // Get unique colors and sizes from variants
  const colorMap = new Map<string, {_id: string; title: string | null; hex?: string | null}>()
  const sizeMap = new Map<string, {_id: string; title: string | null; code: string | null; sortOrder?: number | null}>()

  variants?.forEach((v) => {
    if (v.color?._id) colorMap.set(v.color._id, v.color)
    v.sizes?.forEach((size) => {
      if (size._id) sizeMap.set(size._id, size)
    })
  })

  const colors = [...colorMap.values()]
  const sizes = [...sizeMap.values()].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-neutral-400">
        <Link href="/products" className="transition-colors hover:text-neutral-900">
          Products
        </Link>
        {category && (
          <>
            <span className="mx-2">/</span>
            <span>{category.title}</span>
          </>
        )}
      </nav>

      <ProductDetails
        title={title}
        brand={brand}
        category={category}
        shortDescription={shortDescription}
        price={price}
        features={features}
        materials={materials}
        colors={colors}
        sizes={sizes}
        variants={variants}
      />
    </main>
  )
}
