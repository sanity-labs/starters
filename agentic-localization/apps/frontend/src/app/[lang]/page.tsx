import {getChrome} from '@/sanity/chrome'
import {sanityFetch} from '@/sanity/live'
import {ARTICLES_BY_LANGUAGE_QUERY} from '@/sanity/queries'
import {ArticleCard} from '@/components/ArticleCard'
import {SiteNav} from '@/components/SiteNav'

export default async function HomePage({params}: {params: Promise<{lang: string}>}) {
  const {lang} = await params
  return <ArticleList lang={lang} />
}

async function ArticleList({lang}: {lang: string}) {
  'use cache'

  const [{data: articles}, {strings}] = await Promise.all([
    sanityFetch({
      query: ARTICLES_BY_LANGUAGE_QUERY,
      params: {language: lang},
      perspective: 'published',
      stega: false,
    }),
    getChrome(lang),
  ])

  return (
    <main className="animate-fade-in">
      <SiteNav lang={lang} />

      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">{strings.siteTitle}</h1>
        <p className="mt-3 text-lg text-[var(--color-text-secondary)] leading-relaxed">
          {strings.siteTagline}
        </p>
      </div>

      <h2 className="text-2xl font-semibold mb-5">{strings.articlesHeading}</h2>

      {articles.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">{strings.emptyArticles}</p>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} lang={lang} />
          ))}
        </div>
      )}
    </main>
  )
}
