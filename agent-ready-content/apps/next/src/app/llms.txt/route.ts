import {SITEMAP_QUERY, buildLlmsTxt} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {SITE_INFO} from '@/lib/config'

/**
 * llms.txt per https://llmstxt.org: the standard discovery path for
 * agents. Generated from the same query as /sitemap.md, so the two
 * entry points cannot drift apart. Links point at .md URLs.
 */
export async function GET() {
  try {
    const sections = await client.fetch(SITEMAP_QUERY, {}, {stega: false, tag: 'llms.index'})

    return new Response(buildLlmsTxt(SITE_INFO, sections), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('llms.txt route error:', error)
    return new Response('Internal server error', {status: 500})
  }
}
