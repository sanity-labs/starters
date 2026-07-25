import type {MetadataRoute} from 'next'
import {sanityFetch} from '@/sanity/live'
import {listTranslations} from '@/sanity/locales'
import {LOCALES_QUERY, SITEMAP_QUERY} from '@/sanity/queries'
import {SITE_URL} from '@/site'

const absolute = (path: string) => new URL(path, SITE_URL).toString()

async function loadSitemapData() {
  'use cache'

  const [{data: locales}, {data: articles}] = await Promise.all([
    sanityFetch({query: LOCALES_QUERY, perspective: 'published', stega: false}),
    sanityFetch({query: SITEMAP_QUERY, perspective: 'published', stega: false}),
  ])

  return {locales, articles}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const {locales, articles} = await loadSitemapData()

  const localeHome = locales.map((locale) => ({
    url: absolute(`/${locale.code}`),
    alternates: {
      languages: Object.fromEntries(
        locales.map((alternate) => [alternate.code, absolute(`/${alternate.code}`)]),
      ),
    },
  }))

  // One entry per locale rendition, each pointing at every sibling. Slugs
  // differ per locale, so the alternates come from the translation join.
  const articlePages = articles.map((article) => ({
    url: absolute(`/${article.language}/${article.slug}`),
    lastModified: article._updatedAt,
    alternates: {
      languages: Object.fromEntries(
        listTranslations(article).map((entry) => [
          entry.language,
          absolute(`/${entry.language}/${entry.slug}`),
        ]),
      ),
    },
  }))

  return [...localeHome, ...articlePages]
}
