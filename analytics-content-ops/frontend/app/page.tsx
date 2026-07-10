import Image from 'next/image'
import Link from 'next/link'
import {ArticleCard} from '@/components/article-card'
import {SiteFooter} from '@/components/site-footer'
import {SiteHeader} from '@/components/site-header'
import {sanityFetch} from '@/sanity/live'
import {urlFor} from '@/sanity/image'
import {ARTICLES_QUERY, TRENDING_QUERY} from '@/sanity/queries'
import {type ArticleCardData, formatAuthors, formatDate} from '@/lib/types'

export default async function HomePage() {
  const [{data: articlesData}, {data: trendingData}] = await Promise.all([
    sanityFetch({query: ARTICLES_QUERY}),
    sanityFetch({query: TRENDING_QUERY}),
  ])

  const articles = (articlesData ?? []) as ArticleCardData[]
  const trending = ((trendingData ?? []) as Array<{article: ArticleCardData | null}>)
    .map((row) => row.article)
    .filter((a): a is ArticleCardData => Boolean(a))

  if (articles.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-5 py-24">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
              No stories yet
            </h1>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              Your Sanity dataset is empty. Run{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm seed</code> to import the demo
              content, then{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm analytics-sync</code> to
              populate performance signal.
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const [featured, ...rest] = articles
  const secondary = rest.slice(0, 2)
  const grid = rest.slice(2)

  const featuredImage = featured.image
    ? urlFor(featured.image).width(1200).height(825).fit('crop').url()
    : '/placeholder.svg'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-10 md:py-14">
            <div className="mb-8 flex flex-col gap-4 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
              <h1 className="max-w-2xl text-balance font-serif text-4xl font-medium leading-[1.05] tracking-tight text-foreground md:text-6xl">
                Stories from the open air.
              </h1>
              <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                Friluft Media covers the culture of the Norwegian outdoors — and the modern craft
                behind the stories we tell, straight from the team at Sanity.
              </p>
            </div>

            <Link
              href={`/article/${featured.slug}`}
              className="group grid gap-8 lg:grid-cols-2 lg:items-center"
            >
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-sm bg-muted">
                <Image
                  src={featuredImage}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div>
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">
                    Featured
                  </span>
                  {featured.category && <span className="text-primary">{featured.category}</span>}
                </div>
                <h2 className="mt-5 text-balance font-serif text-3xl font-medium leading-[1.1] tracking-tight text-foreground transition-colors group-hover:text-primary md:text-5xl">
                  {featured.title}
                </h2>
                <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
                  {featured.dek}
                </p>
                <div className="mt-6 flex items-center gap-3 text-sm text-foreground">
                  <span className="font-medium">{formatAuthors(featured.authors)}</span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-muted-foreground">{formatDate(featured.date)}</span>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Trending — powered by synced analytics signal (GROQ, no extra integration) */}
        {trending.length > 0 && (
          <section className="border-b border-border bg-secondary/40">
            <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10">
              <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
                  Trending now
                </h2>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Powered by analytics signal
                </span>
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((article) => (
                  <ArticleCard key={article._id} article={article} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Secondary stories */}
        {secondary.length > 0 && (
          <section className="border-b border-border">
            <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 md:grid-cols-2 md:px-10">
              {secondary.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          </section>
        )}

        {/* Latest grid */}
        {grid.length > 0 && (
          <section>
            <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10">
              <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
                  Latest dispatches
                </h2>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Journal
                </span>
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {grid.map((article) => (
                  <ArticleCard key={article._id} article={article} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Newsletter */}
        <section className="border-t border-border bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="max-w-lg">
              <h2 className="text-balance font-serif text-3xl font-medium leading-tight md:text-4xl">
                Dispatches from the trail, twice a month.
              </h2>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-primary-foreground/80">
                Join readers across Scandinavia for essays, routes, and field notes. No noise — just
                the good stuff.
              </p>
            </div>
            <form className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-5 py-3 text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus:border-primary-foreground/60 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-primary-foreground px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-primary transition-opacity hover:opacity-90"
              >
                Subscribe
              </button>
            </form>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
