import {isShopifyConfigured, getStorefront} from '@/lib/shopify'
import {ProductCard} from '@/components/ProductCard'
import {themeClasses} from '@/components/theme'

const HERO_BLOCKS = [
  {theme: 'yellow', label: 'The Content Operating System'},
  {theme: 'gray', label: 'Enriched in Sanity'},
  {theme: 'orange', label: 'Shipped from Shopify'},
  {theme: 'blue', label: 'No document per product'},
] as const

export default async function HomePage() {
  if (!isShopifyConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="hairline bg-swag-yellow p-8">
          <span className="chip">Setup</span>
          <h1 className="mt-3 text-2xl font-bold">Connect your Shopify store</h1>
          <p className="mt-2 font-mono text-sm">
            Set <code>NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{' '}
            <code>NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN</code> in <code>frontend/.env</code> to load
            products. Run <code className="bg-white px-1">pnpm shopify:storefront-token</code> to
            mint a token.
          </p>
        </div>
      </main>
    )
  }

  const products = await getStorefront().listProducts(24)

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HERO_BLOCKS.map((block) => {
          const t = themeClasses(block.theme)
          return (
            <div
              key={block.label}
              className={`flex aspect-square items-end hairline p-4 halftone ${t.bg} ${t.text}`}
            >
              <p className="text-sm font-bold uppercase leading-tight">{block.label}</p>
            </div>
          )
        })}
      </section>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-bold uppercase tracking-tight">Products</h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-swag-black/50">
          {products.length} from Shopify
        </span>
      </div>

      {products.length === 0 ? (
        <div className="hairline bg-white p-10 text-center font-mono text-sm text-swag-black/60">
          No products found in your Shopify catalog.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}
