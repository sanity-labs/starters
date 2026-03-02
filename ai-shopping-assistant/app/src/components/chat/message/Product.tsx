'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useEffect, useState} from 'react'

import {formatPrice} from '@/lib/utils'
import {client} from '@/sanity/lib/client'
import {urlFor} from '@/sanity/lib/image'

import type {DocumentProps} from './Document'

const QUERY = `
  *[_type == "product" && _id == $id][0] {
    title,
    "slug": slug.current,
    shortDescription,
    "brand": brand->{ title },
    "category": category->{ title },
    price { amount, compareAtPrice },
    "image": variants[0].images[0] {
      asset->{ _id, url, metadata { lqip } },
      alt
    }
  }
`

interface ProductData {
  slug: string
  title: string
  shortDescription?: string | null
  brand?: {title: string | null} | null
  category?: {title: string | null} | null
  price?: {amount?: number | null; compareAtPrice?: number | null} | null
  image?: {
    asset?: {_id: string; url: string | null; metadata?: {lqip?: string | null} | null} | null
    alt?: string | null
  } | null
}

// Module-level promise cache: survives component unmount/remount during streaming.
// Without this, each streaming chunk re-renders ReactMarkdown which remounts Product,
// aborting the in-flight fetch and restarting it — the fetch never completes.
const fetchCache = new Map<string, Promise<ProductData | null>>()

function fetchProduct(id: string): Promise<ProductData | null> {
  const existing = fetchCache.get(id)
  if (existing) return existing

  const promise = client
    .fetch<ProductData | null>(QUERY, {id})
    .catch(() => null)

  fetchCache.set(id, promise)
  return promise
}

export function Product(props: DocumentProps) {
  const {isInline} = props

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProduct(props.id).then((result) => {
      if (!cancelled) {
        setProduct(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [props.id])

  if (loading) {
    if (isInline) return null

    return (
      <div className="flex animate-pulse gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="h-24 w-20 shrink-0 rounded-lg bg-neutral-100" />
        <div className="flex flex-1 flex-col gap-2 py-1">
          <div className="h-3 w-16 rounded bg-neutral-100" />
          <div className="h-4 w-28 rounded bg-neutral-100" />
          <div className="h-3 w-full rounded bg-neutral-100" />
          <div className="h-4 w-14 rounded bg-neutral-100" />
        </div>
      </div>
    )
  }

  if (!product) return null

  if (isInline) {
    return (
      <Link
        href={`/products/${product.slug}`}
        className="text-blue-600 underline hover:text-blue-700"
      >
        {product.title}
      </Link>
    )
  }

  const hasDiscount =
    product.price?.compareAtPrice &&
    product.price.compareAtPrice > (product.price.amount ?? 0)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {product.image?.asset?.url ? (
          <Image
            src={urlFor(product.image).width(160).height(192).url()}
            alt={product.image.alt || product.title || 'Product'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="80px"
            placeholder={product.image.asset.metadata?.lqip ? 'blur' : 'empty'}
            blurDataURL={product.image.asset.metadata?.lqip || undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            No image
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-1 top-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
            Sale
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {(product.brand?.title || product.category?.title) && (
          <p className="truncate text-[11px] tracking-wide text-neutral-400">
            {product.brand?.title}
            {product.brand?.title && product.category?.title && ' / '}
            {product.category?.title}
          </p>
        )}

        <h4 className="truncate text-sm font-medium text-neutral-900 group-hover:underline">
          {product.title}
        </h4>

        {product.shortDescription && (
          <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-sm font-semibold text-neutral-900">
            {formatPrice(product.price?.amount)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-neutral-400 line-through">
              {formatPrice(product.price?.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
