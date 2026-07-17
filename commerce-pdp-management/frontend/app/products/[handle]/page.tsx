import {notFound} from 'next/navigation'
import Link from 'next/link'

import {isShopifyConfigured, getStorefront} from '@/lib/shopify'
import {getMergedProduct} from '@/lib/product'
import {formatMoney} from '@/components/format'
import {AttributeBlock} from '@/components/AttributeBlock'
import {ProductCard} from '@/components/ProductCard'
import {ProductGallery} from '@/components/ProductGallery'
import {PortableText} from '@/components/PortableText'

export default async function ProductPage({params}: {params: Promise<{handle: string}>}) {
  const {handle} = await params

  if (!isShopifyConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="hairline bg-swag-yellow p-8">
          <span className="chip">Setup</span>
          <h1 className="mt-3 text-2xl font-bold">Connect your Shopify store</h1>
          <p className="mt-2 font-mono text-sm">
            Set <code>NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{' '}
            <code>NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN</code> in <code>frontend/.env</code> to load
            this product.
          </p>
        </div>
      </main>
    )
  }

  const merged = await getMergedProduct(handle)
  if (!merged) notFound()

  const {product, enriched, headline, attributes, editorialCopy, lifestyleImages, launchBadge} =
    merged
  const onSale = product.compareAtPrice && product.compareAtPrice.amount > product.price.amount
  const related = await getStorefront().getProductRecommendations(product.id)

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-wider hover:underline">
          ← All products
        </Link>
        <span className="chip">{enriched ? 'Enriched' : 'Pure Shopify'}</span>
        {launchBadge ? <span className="chip">{launchBadge}</span> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          lifestyleImages={lifestyleImages}
          title={product.title}
        />

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight">{headline}</h1>
            {headline !== product.title ? (
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-swag-black/50">
                {product.title}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 font-mono text-lg">
            <span>{formatMoney(product.price)}</span>
            {onSale && product.compareAtPrice ? (
              <span className="text-swag-black/40 line-through">
                {formatMoney(product.compareAtPrice)}
              </span>
            ) : null}
            {!product.availableForSale ? (
              <span className="text-sm uppercase text-swag-black/50">Sold out</span>
            ) : null}
          </div>

          {product.options.length ? (
            <div className="flex flex-col gap-3">
              {product.options.map((option) => (
                <div key={option.name}>
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-swag-black/50">
                    {option.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((v) => (
                      <span key={v} className="hairline px-2 py-1 text-sm">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-2 w-full bg-swag-black px-4 py-3 font-mono text-sm uppercase tracking-wider text-white transition-colors hover:bg-swag-orange hover:text-swag-black"
          >
            Add to cart
          </button>

          {/* SKU-specific editorial (Sanity), layered above the base description. */}
          {editorialCopy ? (
            <div className="prose prose-sm max-w-none font-sans text-swag-black">
              <PortableText value={editorialCopy} />
            </div>
          ) : product.descriptionHtml ? (
            <div
              className="prose prose-sm max-w-none font-sans text-swag-black"
              dangerouslySetInnerHTML={{__html: product.descriptionHtml}}
            />
          ) : null}
        </div>
      </div>

      {/* Rule-resolved attribute content (Sanity), tag-matched via the control plane. */}
      {attributes.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-tight">Product details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {attributes.map((attribute) => (
              <AttributeBlock key={attribute.ruleId} attribute={attribute} />
            ))}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-tight">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
