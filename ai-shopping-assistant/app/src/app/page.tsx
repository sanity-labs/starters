import Link from 'next/link'

import {ProductGrid} from '@/components/ProductGrid'
import {Button} from '@/components/ui/button'
import {client} from '@/sanity/lib/client'
import {FEATURED_PRODUCTS_QUERY} from '@/sanity/queries'

export default async function HomePage() {
  const products = await client.fetch(FEATURED_PRODUCTS_QUERY)

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-200/60 bg-gradient-to-b from-neutral-50 to-white px-6 py-20 text-center md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(74,222,128,0.04),transparent_50%)]" />

        <div className="relative">
          <p className="mx-auto mb-4 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            Milano-Cortina 2026
          </p>

          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
            Gear up for gold
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-500">
            Performance equipment and apparel for every winter discipline. From alpine to ice sports, podium-ready gear awaits.
          </p>

          <div className="mt-10">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/products">Shop All</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              Featured
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Top Picks</h2>
          </div>

          <Link
            href="/products"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            View all
          </Link>
        </div>

        <ProductGrid products={products} />
      </section>
    </main>
  )
}
