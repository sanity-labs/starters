import type {APIRoute} from 'astro'
import {ARTICLE_WITH_NAV_QUERY} from '@agent-ready/markdown'
import {client} from '../../../lib/client'
import {articleOptions, buildArticleMarkdown} from '../../../lib/markdown'

/**
 * Markdown article endpoint. The filename [article].md.ts serves
 * /docs/[section]/[article].md directly; no rewrite layer needed.
 * Header negotiation for the extensionless URL happens in middleware.
 */
export const prerender = false

export const GET: APIRoute = async ({params}) => {
  const data = await client.fetch(
    ARTICLE_WITH_NAV_QUERY,
    {
      sectionSlug: params.section,
      articleSlug: params.article,
    },
    {tag: 'md.article'},
  )

  if (!data.article) {
    return new Response('Article not found', {status: 404})
  }

  return new Response(buildArticleMarkdown(data.article, articleOptions(data, params)), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
