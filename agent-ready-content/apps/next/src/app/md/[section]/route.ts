import {NextRequest} from 'next/server'
import {SECTION_QUERY} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {buildSectionMarkdown} from '@/lib/markdown'

/**
 * Markdown section listing: navigation only, no article content.
 *
 * Internal route: /md/[section]
 * Public access:  /docs/[section].md (rewrite)
 *                 /docs/[section] with Accept: text/markdown
 */
export async function GET(request: NextRequest, {params}: {params: Promise<{section: string}>}) {
  const {section: sectionSlug} = await params

  try {
    const section = await client.fetch(
      SECTION_QUERY,
      {sectionSlug},
      {stega: false, tag: 'md.section'},
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
  } catch (error) {
    console.error('Section markdown route error:', error)
    return new Response('Internal server error', {status: 500})
  }
}
