import type {SanityClient} from '@sanity/client'
import {createConverter} from './serializers'
import type {
  Article,
  ArticleMarkdownOptions,
  SectionListing,
  SiteInfo,
  SitemapSection,
} from './types'

/**
 * Document builders, bound to a client (the image renderer needs one
 * to build CDN URLs). Each app creates its own instance:
 *
 *   export const {buildArticleMarkdown} = createMarkdown(client)
 */
export function createMarkdown(client: SanityClient) {
  const convertToMarkdown = createConverter(client)

  /** Full article: title, summary, canonical URL, body, prev/next footer. */
  function buildArticleMarkdown(article: Article, options: ArticleMarkdownOptions): string {
    const {canonicalUrl, prevArticle, nextArticle} = options
    const lines = [
      `# ${article.title}`,
      '',
      ...(article.summary ? [`> ${article.summary}`, ''] : []),
      `Section: ${article.section.title}`,
      `Canonical: ${canonicalUrl}`,
      '',
      '---',
      '',
      convertToMarkdown(article.content ?? []),
    ]

    const nav: string[] = []
    if (prevArticle) nav.push(`Previous: [${prevArticle.title}](${prevArticle.slug.current}.md)`)
    if (nextArticle) nav.push(`Next: [${nextArticle.title}](${nextArticle.slug.current}.md)`)
    if (nav.length > 0) {
      lines.push('', '---', '', nav.join(' · '))
    }

    return lines.join('\n')
  }

  /** Section listing: navigation only, no article content. */
  function buildSectionMarkdown(section: SectionListing): string {
    const lines = [
      `# ${section.title}`,
      '',
      ...(section.description ? [section.description, ''] : []),
      '## Articles',
      '',
    ]
    for (const article of section.articles) {
      lines.push(`- [${article.title}](/docs/${section.slug.current}/${article.slug.current})`)
      if (article.summary) lines.push(`  ${article.summary}`)
    }
    return lines.join('\n')
  }

  /** Full site index with access instructions, served at /sitemap.md. */
  function buildSitemapMarkdown(site: SiteInfo, sections: SitemapSection[]): string {
    const lines = [
      `# ${site.title} sitemap`,
      '',
      '## How to access content as markdown',
      '',
      '- **Any page**: add `.md` to the URL or send an `Accept: text/markdown` header',
      '- **Section listing**: `/docs/[section].md`',
      '- **This sitemap**: `/sitemap.md`',
      '- **Agent entry point**: `/llms.txt`',
      '',
      '---',
      '',
    ]
    for (const section of sections) {
      lines.push(`## ${section.title}`, '')
      if (section.description) lines.push(section.description, '')
      for (const article of section.articles) {
        lines.push(
          `- [${article.title}](/docs/${section.slug.current}/${article.slug.current})${article.summary ? `: ${article.summary}` : ''}`,
        )
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  return {convertToMarkdown, buildArticleMarkdown, buildSectionMarkdown, buildSitemapMarkdown}
}
