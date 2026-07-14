import {notFound} from 'next/navigation'
import Link from 'next/link'

import {getAudienceTag} from '@/lib/audience'
import {isShopifyConfigured} from '@/lib/shopify'
import {getMergedCollection} from '@/lib/collection'
import {Banner} from '@/components/Banner'
import {FacetRail} from '@/components/FacetRail'
import {ProductGrid} from '@/components/ProductGrid'

export default async function CollectionPage({params}: {params: Promise<{handle: string}>}) {
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
            products for this collection.
          </p>
        </div>
      </main>
    )
  }

  const audienceTag = await getAudienceTag()
  const collection = await getMergedCollection(handle, audienceTag)

  if (!collection) notFound()

  const productCount = collection.grid.filter((item) => item.kind === 'product').length
  const hasFacets = collection.facets.length > 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-wider hover:underline">
          ← All collections
        </Link>
        <span className="chip">{collection.enriched ? 'Enriched' : 'Pure Shopify'}</span>
        {collection.collectionType === 'sanity-custom' ? (
          <span className="chip">Sanity-authored membership</span>
        ) : null}
      </div>

      {collection.banner ? (
        <div className="mb-6">
          <Banner banner={collection.banner} audienceTag={collection.audienceTag} />
        </div>
      ) : (
        <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">{collection.title}</h1>
      )}

      <div className={hasFacets ? 'grid gap-6 lg:grid-cols-[240px_1fr]' : ''}>
        {hasFacets ? <FacetRail facets={collection.facets} /> : null}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold uppercase tracking-tight">{collection.title}</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-swag-black/50">
              {productCount} products
            </span>
          </div>
          <ProductGrid grid={collection.grid} />
        </div>
      </div>
    </main>
  )
}
