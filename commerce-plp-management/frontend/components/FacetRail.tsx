import type {MergedFacet} from '@starter/commerce/types'

/** Non-interactive facet rail — demonstrates merchandiser-controlled order. */
export function FacetRail({facets}: {facets: MergedFacet[]}) {
  if (!facets.length) return null

  return (
    <aside className="hairline bg-white">
      <div className="border-b border-swag-black bg-swag-black px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white">Filters</span>
      </div>
      <div className="divide-y divide-swag-black/15">
        {facets.map((facet) => (
          <div key={facet.handle} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider">{facet.label}</span>
              {facet.promoted ? (
                <span className="bg-swag-yellow px-1 font-mono text-[9px] uppercase">Promoted</span>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {facet.values.slice(0, 8).map((value) => (
                <li
                  key={value.handle}
                  className="border border-swag-black/30 px-2 py-0.5 text-xs text-swag-black/70"
                >
                  {value.label} <span className="text-swag-black/40">({value.count})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  )
}
