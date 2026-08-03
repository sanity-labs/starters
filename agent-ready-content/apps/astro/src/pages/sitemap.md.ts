import type {APIRoute} from 'astro'
import {SITEMAP_QUERY} from '@agent-ready/markdown'
import {client} from '../lib/client'
import {SITE_INFO} from '../lib/config'
import {buildSitemapMarkdown} from '../lib/markdown'

/** Markdown sitemap at /sitemap.md. */
export const prerender = false

export const GET: APIRoute = async () => {
  const sections = await client.fetch(SITEMAP_QUERY, {}, {tag: 'md.sitemap'})

  return new Response(buildSitemapMarkdown(SITE_INFO, sections), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
