import 'server-only'

import {serverClient} from './client'

export interface SearchHit {
  _id: string
  _type: 'helpArticle' | 'faq'
  title?: string
  question?: string
  summary?: string
  slug?: string
}

const PROJECTION = `{
  _id, _type, title, question, summary, "slug": slug.current
}`

const SEMANTIC_QUERY = `
  *[_type in ["helpArticle", "faq"] && status == "published"]
  | score(
      boost([title, summary] match text::query($q), 2),
      text::semanticSimilarity($q)
    )
  | order(_score desc)[0...10] ${PROJECTION}
`

const KEYWORD_QUERY = `
  *[_type in ["helpArticle", "faq"] && status == "published" && (
    title match $term || summary match $term || question match $term ||
    pt::text(content) match $term || pt::text(answer) match $term
  )][0...10] ${PROJECTION}
`

export async function searchContent(query: string): Promise<SearchHit[]> {
  const q = query.trim()
  if (!q) return []

  try {
    return await serverClient.fetch<SearchHit[]>(SEMANTIC_QUERY, {q})
  } catch (error) {
    // Usually "Dataset Embeddings not enabled" — bootstrap enables them, but
    // say so rather than silently degrading to keyword search.
    console.warn(
      '[search] semantic query failed, falling back to keyword match:',
      error instanceof Error ? error.message : error,
    )
    return serverClient.fetch<SearchHit[]>(KEYWORD_QUERY, {term: `${q}*`})
  }
}
