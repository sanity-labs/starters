import Link from 'next/link'
import {themeClasses, type ThemeValue} from './theme'

type CollectionCardProps = {
  handle: string
  title: string
  collectionType: 'shopify-native' | 'sanity-custom'
  theme: ThemeValue
  imageUrl?: string | null
}

export function CollectionCard({
  handle,
  title,
  collectionType,
  theme,
  imageUrl,
}: CollectionCardProps) {
  const t = themeClasses(theme)

  return (
    <Link
      href={`/collections/${handle}`}
      className={`group relative flex aspect-square flex-col justify-between overflow-hidden hairline p-4 ${t.bg} ${t.text}`}
    >
      <div className="absolute inset-0 halftone opacity-40" aria-hidden />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply transition-transform duration-150 group-hover:scale-[1.03]"
        />
      ) : null}

      <div className="relative flex items-start justify-between">
        <span className="chip">{collectionType === 'sanity-custom' ? 'Custom' : 'Collection'}</span>
      </div>
      <div className="relative">
        <h3 className="text-2xl font-bold uppercase leading-none">{title}</h3>
        <span className="mt-2 inline-block font-mono text-[11px] uppercase tracking-wider underline underline-offset-4">
          Select {title} →
        </span>
      </div>
    </Link>
  )
}
