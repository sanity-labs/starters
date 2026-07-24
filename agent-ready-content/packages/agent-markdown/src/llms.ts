import type {SiteInfo, SitemapSection} from './types'

/**
 * Build an llms.txt document per https://llmstxt.org:
 * an H1, a blockquote summary, free-form notes, then H2 sections
 * of annotated links. Links point at the .md URLs so an agent that
 * starts here never touches HTML at all.
 */
export function buildLlmsTxt(site: SiteInfo, sections: SitemapSection[]): string {
  const lines = [
    `# ${site.title}`,
    '',
    `> ${site.summary}`,
    '',
    'Every page is available as markdown: append `.md` to its URL,',
    'or request it with an `Accept: text/markdown` header.',
    'A full index with per-article summaries lives at `/sitemap.md`.',
    '',
  ]

  for (const section of sections) {
    lines.push(`## ${section.title}`, '')
    for (const article of section.articles) {
      lines.push(
        `- [${article.title}](${site.url}/docs/${section.slug.current}/${article.slug.current}.md): ${article.summary}`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}
