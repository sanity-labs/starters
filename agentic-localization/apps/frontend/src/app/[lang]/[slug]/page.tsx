import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import Link from 'next/link'
import {Suspense} from 'react'
import {getChrome} from '@/sanity/chrome'
import {PUBLISHED, resolvePreview, sanityFetch, type Preview} from '@/sanity/live'
import {listTranslations, resolveFallbackChain} from '@/sanity/locales'
import {ARTICLE_QUERY, ARTICLE_SLUGS_QUERY, DEFAULT_LANGUAGE} from '@/sanity/queries'
import type {ArticleResolution, Translation} from '@/sanity/types'
import {formatUiString} from '@/sanity/uiStrings'
import {FallbackBanner} from '@/components/FallbackBanner'
import {Body} from '@/components/PortableText'
import {SiteNav} from '@/components/SiteNav'

export async function generateStaticParams({params}: {params: {lang: string}}) {
  'use cache'

  const {data: slugs} = await sanityFetch({
    query: ARTICLE_SLUGS_QUERY,
    params: {language: params.lang},
    ...PUBLISHED,
  })

  if (slugs.length > 0) return definedSlugs(slugs)

  // Cache Components rejects an empty result. A locale with no translations of
  // its own still serves every default-language slug, as a fallback render.
  const {data: fallbackSlugs} = await sanityFetch({
    query: ARTICLE_SLUGS_QUERY,
    params: {language: DEFAULT_LANGUAGE},
    ...PUBLISHED,
  })

  return definedSlugs(fallbackSlugs)
}

function definedSlugs(rows: {slug: string | null}[]): {slug: string}[] {
  return rows.flatMap((row) => (row.slug ? [{slug: row.slug}] : []))
}

async function loadArticle(slug: string, language: string, preview: Preview) {
  'use cache'

  const {data} = await sanityFetch({query: ARTICLE_QUERY, params: {slug, language}, ...preview})

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
async function resolve(slug: string, language: string, preview: Preview): Promise<Resolved | null> {
  const article = await loadArticle(slug, language, preview)
  if (!article) return null

  const translations = listTranslations(article)

  if (article.language === language) return {article, translations, fallbackFrom: null}

  const own = translations.find((entry) => entry.language === language)
  if (own) redirect(`/${language}/${own.slug}`)

  for (const candidate of resolveFallbackChain(language, article.locales)) {
    if (candidate === article.language) return {article, translations, fallbackFrom: language}

    const translation = translations.find((entry) => entry.language === candidate)
    if (!translation) continue

    const fallback = await loadArticle(translation.slug, candidate, preview)
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
  // Always the published rendition: metadata has no Suspense boundary, so a
  // `resolvePreview()` here would force the whole route dynamic
  // (blocking-route). Draft previewing is the page body's job — and stega
  // characters could never be stripped from `<title>` or alternate URLs anyway.
  const resolved = await resolve(slug, lang, PUBLISHED)
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
      title: article.title ?? undefined,
      description: article.excerpt ?? undefined,
      url: `/${lang}/${slug}`,
      locale: lang.replace('-', '_'),
      alternateLocale: translations
        .filter((entry) => entry.language !== lang)
        .map((entry) => entry.language.replace('-', '_')),
    },
  }
}

// `resolvePreview` reads request state, which cache components only allows
// inside a Suspense boundary — outside one it would block the whole route.
export default function ArticlePage({params}: {params: Promise<{lang: string; slug: string}>}) {
  return (
    <Suspense>
      <ResolvedArticle params={params} />
    </Suspense>
  )
}

async function ResolvedArticle({params}: {params: Promise<{lang: string; slug: string}>}) {
  const {lang, slug} = await params
  const preview = await resolvePreview()
  const [resolved, {strings}] = await Promise.all([
    resolve(slug, lang, preview),
    getChrome(lang, preview),
  ])

  if (!resolved) {
    notFound()
  }

  const {article, translations, fallbackFrom} = resolved

  return (
    <div className="animate-fade-in">
      <SiteNav lang={lang} preview={preview} translations={translations} />

      <Link
        href={`/${lang}`}
        className="group inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)] mb-8"
      >
        <span className="transition-transform duration-[var(--transition-fast)] group-hover:-translate-x-0.5">
          &larr;
        </span>
        {strings.backToArticles}
      </Link>

      {fallbackFrom && article.language && (
        <FallbackBanner
          notice={formatUiString(strings.fallbackNotice, {
            locale: fallbackFrom,
            fallback: article.language,
          })}
        />
      )}

      <article className="prose prose-lg max-w-none">
        <h1>{article.title}</h1>

        {article.author?.name && (
          <p className="text-[var(--color-text-secondary)] not-prose">
            {formatUiString(strings.byline, {name: article.author.name})}
          </p>
        )}

        {article.publishedAt && (
          <time className="text-sm text-[var(--color-text-muted)] not-prose block mb-6">
            {new Date(article.publishedAt).toLocaleDateString(lang)}
          </time>
        )}

        {article.body && <Body value={article.body} />}
      </article>
    </div>
  )
}
