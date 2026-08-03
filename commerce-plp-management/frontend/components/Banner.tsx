import type {Banner as BannerType} from '@starter/commerce/types'
import {themeClasses} from './theme'

export function Banner({banner, audienceTag}: {banner: BannerType; audienceTag: string | null}) {
  const t = themeClasses(banner.theme)

  return (
    <section className={`relative overflow-hidden hairline ${t.bg} ${t.text}`}>
      <div className="absolute inset-0 halftone opacity-60" aria-hidden />
      {banner.imageUrl ? (
        <img
          src={banner.imageUrl}
          alt={banner.headline ?? ''}
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        />
      ) : null}

      <div className="relative flex flex-col gap-3 p-8 sm:p-12">
        {audienceTag ? (
          <span className="chip w-fit">Audience · {audienceTag}</span>
        ) : (
          <span className="chip w-fit">Collection</span>
        )}
        {banner.headline ? (
          <h1 className="max-w-3xl text-3xl font-bold leading-[1.05] sm:text-5xl">
            {banner.headline}
          </h1>
        ) : null}
        {banner.subhead ? <p className="max-w-xl text-base sm:text-lg">{banner.subhead}</p> : null}
        {banner.ctaLabel ? (
          <a
            href={banner.ctaHref || '#grid'}
            className="mt-2 w-fit bg-swag-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-white"
          >
            {banner.ctaLabel} →
          </a>
        ) : null}
      </div>
    </section>
  )
}
