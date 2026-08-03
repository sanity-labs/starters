import type {APIRoute} from 'astro'
import {SECTION_QUERY} from '@agent-ready/markdown'
import {client} from '../../lib/client'
import {buildSectionMarkdown} from '../../lib/markdown'

/** Markdown section listing at /docs/[section].md. Navigation only. */
export const prerender = false

export const GET: APIRoute = async ({params}) => {
  const section = await client.fetch(
    SECTION_QUERY,
    {sectionSlug: params.section},
    {tag: 'md.section'},
  )

  if (!section) {
    return new Response('Section not found', {status: 404})
  }

  return new Response(buildSectionMarkdown(section), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
