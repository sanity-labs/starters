import Image from 'next/image'
import Link from 'next/link'
import {urlFor} from '@/sanity/image'
import {type ArticleCardData, formatAuthors, readingTimeLabel} from '@/lib/types'

export function ArticleCard({
  article,
  priority = false,
}: {
  article: ArticleCardData
  priority?: boolean
}) {
  const imageUrl = article.image
    ? urlFor(article.image).width(800).height(600).fit('crop').url()
    : '/placeholder.svg'

  return (
    <Link href={`/article/${article.slug}`} className="group flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-muted">
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {article.category && <span className="text-primary">{article.category}</span>}
        <span aria-hidden>·</span>
        <span>{readingTimeLabel(article.readingTimeMinutes)}</span>
      </div>
      <h3 className="mt-2 text-balance font-serif text-xl font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
        {article.title}
      </h3>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
        {article.dek}
      </p>
      <p className="mt-3 text-xs font-medium text-foreground">{formatAuthors(article.authors)}</p>
    </Link>
  )
}
