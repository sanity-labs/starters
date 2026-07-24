import {SITEMAP_QUERY} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {buildSitemapMarkdown} from '@/lib/markdown'
import {SITE_INFO} from '@/lib/config'

/**
 * Markdown sitemap at /sitemap.md. The folder is literally named
 * sitemap.md; the .md is part of the route path, not a file extension.
 * Coexists with /sitemap.xml.
 */
export async function GET() {
  try {
    const sections = await client.fetch(SITEMAP_QUERY, {}, {stega: false, tag: 'md.sitemap'})

    return new Response(buildSitemapMarkdown(SITE_INFO, sections), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Sitemap route error:', error)
    return new Response('Internal server error', {status: 500})
  }
}
