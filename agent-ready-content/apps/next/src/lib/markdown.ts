import {createMarkdown} from '@agent-ready/markdown'
import {client} from '@/sanity/client'

/**
 * Builders bound to this app's client. The Astro app creates its own
 * binding from the same package; the logic lives in one place.
 */
export const {convertToMarkdown, buildArticleMarkdown, buildSectionMarkdown, buildSitemapMarkdown} =
  createMarkdown(client)
