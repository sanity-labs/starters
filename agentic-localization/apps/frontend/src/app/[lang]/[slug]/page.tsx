import {notFound} from 'next/navigation'
import Link from 'next/link'
import {sanityFetch} from '@/sanity/fetch'
import {ARTICLE_BY_SLUG_QUERY, ARTICLE_FALLBACK_QUERY, DEFAULT_LANGUAGE} from '@/sanity/queries'
import type {ArticleDetail} from '@/sanity/types'
import {FallbackBanner} from '@/components/FallbackBanner'
import {Body} from '@/components/PortableText'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{lang: string; slug: string}>
}) {
  const {lang, slug} = await params

  let article = await sanityFetch<ArticleDetail | null>(ARTICLE_BY_SLUG_QUERY, {
    slug,
    language: lang,
  })

  let isFallback = false

  if (!article && lang !== DEFAULT_LANGUAGE) {
    article = await sanityFetch<ArticleDetail | null>(ARTICLE_FALLBACK_QUERY, {
      slug,
      fallbackLanguage: DEFAULT_LANGUAGE,
    })
    isFallback = true
  }

  if (!article) {
    notFound()
  }

  return (
    <div>
      <Link
        href={`/${lang}`}
        className="group inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)] mb-8"
      >
        <span className="transition-transform duration-[var(--transition-fast)] group-hover:-translate-x-0.5">
          &larr;
        </span>
        Back to articles
      </Link>

      {isFallback && <FallbackBanner locale={lang} fallbackLanguage={DEFAULT_LANGUAGE} />}

      <article className="prose prose-lg max-w-none">
        <h1>{article.title}</h1>

        {article.author?.name && (
          <p className="text-[var(--color-text-secondary)] not-prose">By {article.author.name}</p>
        )}

        {article.publishedAt && (
          <time className="text-sm text-[var(--color-text-muted)] not-prose block mb-6">
            {new Date(article.publishedAt).toLocaleDateString()}
          </time>
        )}

        {article.body && <Body value={article.body} />}
      </article>
    </div>
  )
}
