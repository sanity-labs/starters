import {sanityFetch} from '@/sanity/live'
import {allCollectionsQuery} from '@/sanity/queries'
import {CollectionCard} from '@/components/CollectionCard'
import {themeClasses} from '@/components/theme'

const HERO_BLOCKS = [
  {theme: 'yellow', label: 'The Content Operating System'},
  {theme: 'gray', label: 'Merchandised in Sanity'},
  {theme: 'orange', label: 'Shipped from Shopify'},
  {theme: 'blue', label: 'No developer ticket'},
] as const

export default async function HomePage() {
  const {data: collections} = await sanityFetch({query: allCollectionsQuery})

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
        <h2 className="text-xl font-bold uppercase tracking-tight">Collections</h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-swag-black/50">
          {collections.length} enriched
        </span>
      </div>

      {collections.length === 0 ? (
        <div className="hairline bg-white p-10 text-center font-mono text-sm text-swag-black/60">
          No collections yet. Run <code className="bg-swag-yellow px-1">pnpm seed</code> to add the
          demo collections, then open Studio to attach products.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map((c) => (
            <CollectionCard
              key={c.handle}
              handle={c.handle as string}
              title={c.title as string}
              collectionType={c.collectionType as 'shopify-native' | 'sanity-custom'}
              theme={c.theme}
              imageUrl={c.bannerImageUrl}
            />
          ))}
        </div>
      )}
    </main>
  )
}
