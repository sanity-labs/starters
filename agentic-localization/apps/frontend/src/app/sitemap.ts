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

  const codes = locales.flatMap((locale) => (locale.code ? [locale.code] : []))

  const localeHome = codes.map((code) => ({
    url: absolute(`/${code}`),
    alternates: {
      languages: Object.fromEntries(
        codes.map((alternate) => [alternate, absolute(`/${alternate}`)]),
      ),
    },
  }))

  // One entry per locale rendition, each pointing at every sibling. Slugs
  // differ per locale, so the alternates come from the translation join.
  const articlePages = articles.flatMap((article) => {
    const translations = listTranslations(article)
    const self = translations.find((entry) => entry.language === article.language)
    if (!self) return []

    return [
      {
        url: absolute(`/${self.language}/${self.slug}`),
        lastModified: article._updatedAt,
        alternates: {
          languages: Object.fromEntries(
            translations.map((entry) => [
              entry.language,
              absolute(`/${entry.language}/${entry.slug}`),
            ]),
          ),
        },
      },
    ]
  })

  return [...localeHome, ...articlePages]
}
