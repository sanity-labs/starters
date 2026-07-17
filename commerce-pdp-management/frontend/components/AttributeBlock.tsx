import type {ResolvedAttribute} from '@starter/commerce/types'
import {categoryLabel} from './format'
import {PortableText} from './PortableText'

export function AttributeBlock({attribute}: {attribute: ResolvedAttribute}) {
  return (
    <section className="hairline bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        {attribute.iconUrl ? (
          <img src={attribute.iconUrl} alt="" width={20} height={20} className="object-contain" />
        ) : null}
        <span className="font-mono text-[11px] uppercase tracking-wider text-swag-black/50">
          {categoryLabel(attribute.category)}
        </span>
      </div>
      <h3 className="mb-2 text-base font-bold uppercase tracking-tight">{attribute.name}</h3>
      {attribute.description ? (
        <div className="prose prose-sm max-w-none font-sans text-swag-black">
          <PortableText value={attribute.description} />
        </div>
      ) : null}
    </section>
  )
}
