import {sanityFetch} from '@/sanity/fetch'
import {ARTICLES_BY_LANGUAGE_QUERY} from '@/sanity/queries'
import type {ArticleCard as ArticleCardType} from '@/sanity/types'
import {ArticleCard} from '@/components/ArticleCard'

export default async function HomePage({params}: {params: Promise<{lang: string}>}) {
  const {lang} = await params

  const articles = await sanityFetch<ArticleCardType[]>(ARTICLES_BY_LANGUAGE_QUERY, {
    language: lang,
  })

  return (
    <main>
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">L10n Starter</h1>
        <p className="mt-3 text-lg text-[var(--color-text-secondary)] leading-relaxed">
          A minimal frontend demonstrating locale-filtered content from Sanity. Switch languages
          above to see articles in different locales.
        </p>
      </div>

      <h2 className="text-2xl font-semibold mb-5">Articles</h2>

      {articles.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No articles available in this language.</p>
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
