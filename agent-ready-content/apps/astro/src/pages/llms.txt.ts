import type {APIRoute} from 'astro'
import {SITEMAP_QUERY, buildLlmsTxt} from '@agent-ready/markdown'
import {client} from '../lib/client'
import {SITE_INFO} from '../lib/config'

/**
 * llms.txt per https://llmstxt.org, generated from the same query as
 * /sitemap.md. Links point at .md URLs so agents stay in markdown.
 */
export const prerender = false

export const GET: APIRoute = async () => {
  const sections = await client.fetch(SITEMAP_QUERY, {}, {tag: 'llms.index'})

  return new Response(buildLlmsTxt(SITE_INFO, sections), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
