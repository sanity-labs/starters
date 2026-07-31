import type {Metadata} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {ArticleCard} from '@/components/article-card'
import {PortableText} from '@/components/portable-text'
import {SiteFooter} from '@/components/site-footer'
import {SiteHeader} from '@/components/site-header'
import {sanityFetch} from '@/sanity/live'
import {urlFor} from '@/sanity/image'
import {ARTICLE_QUERY, ARTICLE_SLUGS_QUERY, RELATED_QUERY} from '@/sanity/queries'
import {
  type ArticleCardData,
  type ArticleData,
  formatAuthors,
  formatDate,
  readingTimeLabel,
} from '@/lib/types'

export async function generateStaticParams() {
  // Resilient to an empty/unconfigured dataset so the first `next build`
  // succeeds before any content has been seeded.
  try {
    const {data} = await sanityFetch({
      query: ARTICLE_SLUGS_QUERY,
      perspective: 'published',
      stega: false,
    })
    return ((data ?? []) as Array<{slug: string | null}>)
      .filter((p): p is {slug: string} => Boolean(p.slug))
      .map((p) => ({slug: p.slug}))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{slug: string}>
}): Promise<Metadata> {
  const {slug} = await params
  const {data} = await sanityFetch({query: ARTICLE_QUERY, params: {slug}, stega: false})
  const article = data as ArticleData | null
  if (!article) return {title: 'Not found — Friluft Media'}
  return {
    title: article.seoTitle || `${article.title} — Friluft Media`,
    description: article.seoDescription || article.dek || undefined,
  }
}

export default async function ArticlePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params

  const [{data: postData}, {data: relatedData}] = await Promise.all([
    sanityFetch({query: ARTICLE_QUERY, params: {slug}}),
    sanityFetch({query: RELATED_QUERY, params: {slug}}),
  ])

  const article = postData as ArticleData | null
  if (!article) notFound()

  const related = (relatedData ?? []) as ArticleCardData[]
  const authors = formatAuthors(article.authors)
  const leadImage = article.image
    ? urlFor(article.image).width(1600).height(900).fit('crop').url()
    : '/placeholder.svg'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <article>
          <div className="mx-auto max-w-3xl px-5 pb-10 pt-12 md:px-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span aria-hidden>←</span>
              Back to journal
            </Link>

            <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {article.category && <span className="text-primary">{article.category}</span>}
              <span aria-hidden>·</span>
              <span>{readingTimeLabel(article.readingTimeMinutes)}</span>
            </div>

            <h1 className="mt-4 text-balance font-serif text-4xl font-medium leading-[1.08] tracking-tight text-foreground md:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              {article.dek}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
              <div className="text-sm">
                <span className="font-medium text-foreground">{authors}</span>
                <span className="mx-2 text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground">{formatDate(article.date)}</span>
              </div>
              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-primary transition-opacity hover:opacity-80"
                >
                  Read on Sanity <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </div>

          <div className="mx-auto max-w-5xl px-5 md:px-10">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm bg-muted">
              <Image
                src={leadImage}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mx-auto max-w-2xl px-5 py-12 md:px-10">
            {article.body && <PortableText value={article.body} />}

            {article.sourceUrl && (
              <div className="mt-10 rounded-sm border border-border bg-card p-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This is a real article originally published on the Sanity blog, written by{' '}
                  {authors}. Read the full, original version at{' '}
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    sanity.io/blog
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <section className="border-t border-border">
            <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10">
              <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
                  Keep reading
                </h2>
                <Link
                  href="/"
                  className="text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  All stories
                </Link>
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((rel) => (
                  <ArticleCard key={rel._id} article={rel} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
