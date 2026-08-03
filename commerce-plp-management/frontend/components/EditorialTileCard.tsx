import type {ComponentProps} from 'react'
import {PortableText} from '@portabletext/react'
import type {EditorialTile} from '@starter/commerce/types'
import {themeClasses} from './theme'

type PortableTextValue = ComponentProps<typeof PortableText>['value']

export function EditorialTileCard({tile}: {tile: EditorialTile}) {
  const t = themeClasses(tile.theme)

  return (
    <article className={`relative flex flex-col justify-between hairline p-5 ${t.bg} ${t.text}`}>
      <span className="chip w-fit">Editorial</span>

      {tile.imageUrl ? (
        <img
          src={tile.imageUrl}
          alt={tile.headline ?? ''}
          className="my-4 aspect-video w-full object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {tile.headline ? (
          <h3 className="text-xl font-bold leading-tight">{tile.headline}</h3>
        ) : null}
        {tile.body ? (
          <div className="text-sm leading-snug opacity-90">
            <PortableText value={tile.body as unknown as PortableTextValue} />
          </div>
        ) : null}
        {tile.ctaLabel ? (
          <a
            href={tile.ctaHref || '#'}
            className={`mt-2 w-fit font-mono text-xs uppercase tracking-wider underline underline-offset-4`}
          >
            {tile.ctaLabel} →
          </a>
        ) : null}
      </div>
    </article>
  )
}
