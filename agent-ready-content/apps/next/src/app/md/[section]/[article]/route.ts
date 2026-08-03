import {NextRequest} from 'next/server'
import {ARTICLE_WITH_NAV_QUERY, prevNext} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {buildArticleMarkdown} from '@/lib/markdown'
import {SITE_URL} from '@/lib/config'

/**
 * Markdown article route.
 *
 * Internal route: /md/[section]/[article]
 * Public access:  /docs/[section]/[article].md (rewrite)
 *                 /docs/[section]/[article] with Accept: text/markdown
 */
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{section: string; article: string}>},
) {
  const {section: sectionSlug, article: articleSlug} = await params

  try {
    const data = await client.fetch(
      ARTICLE_WITH_NAV_QUERY,
      {sectionSlug, articleSlug},
      {stega: false, tag: 'md.article'},
    )

    if (!data.article) {
      return new Response('Article not found', {status: 404})
    }

    const markdown = buildArticleMarkdown(data.article, {
      canonicalUrl: `${SITE_URL}/docs/${sectionSlug}/${articleSlug}`,
      ...prevNext(data.allArticles, articleSlug),
    })

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Markdown route error:', error)
    return new Response('Internal server error', {status: 500})
  }
}
