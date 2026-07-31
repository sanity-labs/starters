import {createMarkdown, prevNext} from '@agent-ready/markdown'
import type {ArticleWithNav} from '@agent-ready/markdown'
import {client} from './client'
import {SITE_URL} from './config'

/** Builders bound to this app's client. Same package the Next.js app uses. */
export const {convertToMarkdown, buildArticleMarkdown, buildSectionMarkdown, buildSitemapMarkdown} =
  createMarkdown(client)

/** Canonical URL and prev/next options for an article endpoint. */
export function articleOptions(data: ArticleWithNav, params: {section?: string; article?: string}) {
  return {
    canonicalUrl: `${SITE_URL}/docs/${params.section}/${params.article}`,
    ...prevNext(data.allArticles, params.article ?? ''),
  }
}
