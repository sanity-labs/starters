import Link from 'next/link'
import type {ShopifyProduct} from '@starter/commerce/types'
import {formatMoney} from './format'

export function ProductCard({product}: {product: ShopifyProduct}) {
  const imageUrl = product.featuredImage?.url
  const onSale = product.compareAtPrice && product.compareAtPrice.amount > product.price.amount

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group relative flex flex-col hairline bg-white"
    >
      <div className="relative aspect-square overflow-hidden bg-swag-gray/10 halftone">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.featuredImage?.altText || product.title}
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-swag-black/40">
            NO IMAGE
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 border-t border-swag-black p-3">
        <h3 className="text-sm font-semibold leading-tight">{product.title}</h3>
        <div className="mt-auto flex items-center gap-2 pt-2 font-mono text-sm">
          <span>{formatMoney(product.price)}</span>
          {onSale && product.compareAtPrice ? (
            <span className="text-swag-black/40 line-through">
              {formatMoney(product.compareAtPrice)}
            </span>
          ) : null}
          {!product.availableForSale ? (
            <span className="ml-auto text-xs uppercase text-swag-black/50">Sold out</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
