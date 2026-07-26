import {Suspense} from 'react'
import {getChrome} from '@/sanity/chrome'
import {resolvePreview, sanityFetch, type Preview} from '@/sanity/live'
import {ARTICLES_BY_LANGUAGE_QUERY} from '@/sanity/queries'
import {ArticleCard} from '@/components/ArticleCard'
import {SiteNav} from '@/components/SiteNav'

// `resolvePreview` reads request state, which cache components only allows
// inside a Suspense boundary — outside one it would block the whole route.
export default function HomePage({params}: {params: Promise<{lang: string}>}) {
  return (
    <Suspense>
      <ResolvedHome params={params} />
    </Suspense>
  )
}

async function ResolvedHome({params}: {params: Promise<{lang: string}>}) {
  const {lang} = await params
  const preview = await resolvePreview()

  return <ArticleList lang={lang} preview={preview} />
}

async function ArticleList({lang, preview}: {lang: string; preview: Preview}) {
  'use cache'

  const [{data: articles}, {strings}] = await Promise.all([
    sanityFetch({query: ARTICLES_BY_LANGUAGE_QUERY, params: {language: lang}, ...preview}),
    getChrome(lang, preview),
  ])

  return (
    <main className="animate-fade-in">
      <SiteNav lang={lang} preview={preview} />

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
