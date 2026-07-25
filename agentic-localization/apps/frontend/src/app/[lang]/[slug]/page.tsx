import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import Link from 'next/link'
import {sanityFetch} from '@/sanity/live'
import {listTranslations, resolveFallbackChain} from '@/sanity/locales'
import {ARTICLE_QUERY, ARTICLE_SLUGS_QUERY, DEFAULT_LANGUAGE} from '@/sanity/queries'
import type {ArticleResolution, Translation} from '@/sanity/types'
import {FallbackBanner} from '@/components/FallbackBanner'
import {Body} from '@/components/PortableText'
import {SiteNav} from '@/components/SiteNav'

export async function generateStaticParams({params}: {params: {lang: string}}) {
  'use cache'

  const {data: slugs} = await sanityFetch({
    query: ARTICLE_SLUGS_QUERY,
    params: {language: params.lang},
    perspective: 'published',
    stega: false,
  })

  if (slugs.length > 0) return slugs

  // Cache Components rejects an empty result. A locale with no translations of
  // its own still serves every default-language slug, as a fallback render.
  const {data: fallbackSlugs} = await sanityFetch({
    query: ARTICLE_SLUGS_QUERY,
    params: {language: DEFAULT_LANGUAGE},
    perspective: 'published',
    stega: false,
  })

  return fallbackSlugs
}

async function loadArticle(slug: string, language: string) {
  'use cache'

  const {data} = await sanityFetch({
    query: ARTICLE_QUERY,
    params: {slug, language},
    perspective: 'published',
    stega: false,
  })

  return data
}

interface Resolved {
  article: ArticleResolution
  translations: Translation[]
  /** The requested locale, when a fallback answered in its place. */
  fallbackFrom: string | null
}

/**
 * A slug belongs to one locale, so there are three outcomes: the requested
 * locale owns it; another locale owns it but the requested one has a slug of
 * its own (the URL is stale — redirect to it); or nobody has it in the
 * requested locale and the fallback chain decides what to show instead.
 */
async function resolve(slug: string, language: string): Promise<Resolved | null> {
  const article = await loadArticle(slug, language)
  if (!article) return null

  const translations = listTranslations(article)

  if (article.language === language) return {article, translations, fallbackFrom: null}

  const own = translations.find((entry) => entry.language === language)
  if (own) redirect(`/${language}/${own.slug}`)

  for (const candidate of resolveFallbackChain(language, article.locales)) {
    if (candidate === article.language) return {article, translations, fallbackFrom: language}

    const translation = translations.find((entry) => entry.language === candidate)
    if (!translation) continue

    const fallback = await loadArticle(translation.slug, candidate)
    if (fallback) return {article: fallback, translations, fallbackFrom: language}
  }

  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{lang: string; slug: string}>
}): Promise<Metadata> {
  const {lang, slug} = await params
  const resolved = await resolve(slug, lang)
  if (!resolved) return {}

  const {article, translations} = resolved
  const languages = Object.fromEntries(
    translations.map((entry) => [entry.language, `/${entry.language}/${entry.slug}`]),
  )
  const source = translations.find((entry) => entry.language === DEFAULT_LANGUAGE)

  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: `/${lang}/${slug}`,
      languages: {
        ...languages,
        'x-default': source ? `/${DEFAULT_LANGUAGE}/${source.slug}` : `/${lang}/${slug}`,
      },
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.excerpt ?? undefined,
      url: `/${lang}/${slug}`,
      locale: lang.replace('-', '_'),
      alternateLocale: translations
        .filter((entry) => entry.language !== lang)
        .map((entry) => entry.language.replace('-', '_')),
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{lang: string; slug: string}>
}) {
  const {lang, slug} = await params
  const resolved = await resolve(slug, lang)

  if (!resolved) {
    notFound()
  }

  const {article, translations, fallbackFrom} = resolved

  return (
    <div className="animate-fade-in">
      <SiteNav lang={lang} translations={translations} />

      <Link
        href={`/${lang}`}
        className="group inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)] mb-8"
      >
        <span className="transition-transform duration-[var(--transition-fast)] group-hover:-translate-x-0.5">
          &larr;
        </span>
        Back to articles
      </Link>

      {fallbackFrom && <FallbackBanner locale={fallbackFrom} fallbackLanguage={article.language} />}

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
