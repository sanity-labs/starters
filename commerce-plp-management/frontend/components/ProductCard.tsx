import type {GridProductItem} from '@starter/commerce/types'
import {formatMoney} from './format'
import {BadgePill} from './BadgePill'

export function ProductCard({item}: {item: GridProductItem}) {
  const {product, badges, isFaceout, faceoutHeadline, faceoutImageUrl} = item
  const imageUrl = faceoutImageUrl || product.featuredImage?.url
  const onSale = product.compareAtPrice && product.compareAtPrice.amount > product.price.amount

  return (
    <article
      className={`group relative flex flex-col hairline bg-white ${isFaceout ? 'sm:col-span-2 sm:row-span-2' : ''}`}
    >
      {(badges.length > 0 || isFaceout) && (
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {isFaceout ? <span className="chip">Faceout</span> : null}
          {badges.map((b, i) => (
            <BadgePill key={`${b.label}-${i}`} badge={b} />
          ))}
        </div>
      )}

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
        {faceoutHeadline ? (
          <p className="font-mono text-xs uppercase tracking-wider text-swag-orange">
            {faceoutHeadline}
          </p>
        ) : null}
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
    </article>
  )
}
