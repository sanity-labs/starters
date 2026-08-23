import type {ShopifyImage} from '@starter/commerce/types'

/**
 * Product media gallery. Prefers the SKU-specific lifestyle images (Sanity) when
 * present, otherwise falls back to the Shopify product images.
 */
export function ProductGallery({
  images,
  lifestyleImages,
  title,
}: {
  images: ShopifyImage[]
  lifestyleImages: ShopifyImage[]
  title: string
}) {
  const gallery = lifestyleImages.length ? lifestyleImages : images
  const [hero, ...rest] = gallery

  if (!hero) {
    return (
      <div className="flex aspect-square items-center justify-center hairline bg-swag-gray/10 halftone font-mono text-xs text-swag-black/40">
        NO IMAGE
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden hairline bg-swag-gray/10 halftone">
        <img src={hero.url} alt={hero.altText || title} className="h-full w-full object-cover" />
        {lifestyleImages.length ? (
          <span className="chip absolute left-2 top-2">Lifestyle · Sanity</span>
        ) : null}
      </div>
      {rest.length ? (
        <div className="grid grid-cols-4 gap-2">
          {rest.slice(0, 4).map((img, i) => (
            <div key={i} className="aspect-square overflow-hidden hairline bg-swag-gray/10">
              <img
                src={img.url}
                alt={img.altText || `${title} ${i + 2}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
