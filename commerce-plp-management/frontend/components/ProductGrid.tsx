import type {GridItem} from '@starter/commerce/types'
import {ProductCard} from './ProductCard'
import {EditorialTileCard} from './EditorialTileCard'

export function ProductGrid({grid}: {grid: GridItem[]}) {
  if (!grid.length) {
    return (
      <div className="hairline bg-white p-10 text-center font-mono text-sm text-swag-black/50">
        No products in this collection yet.
      </div>
    )
  }

  return (
    <div id="grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 auto-rows-[1fr]">
      {grid.map((item, index) =>
        item.kind === 'product' ? (
          <ProductCard key={`${item.product.id}-${index}`} item={item} />
        ) : (
          <EditorialTileCard key={`tile-${item.tile.position}-${index}`} tile={item.tile} />
        ),
      )}
    </div>
  )
}
