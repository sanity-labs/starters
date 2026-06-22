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

// Hybrid retrieval: semantic ranking via Dataset Embeddings. These queries use
// score()/text::semanticSimilarity(), which are intentionally kept out of
// TypeGen (dynamic functions), so results are typed manually here.
const SEMANTIC_QUERY = `
  *[_type in ["helpArticle", "faq"] && status == "published"]
  | score(text::semanticSimilarity($q))
  | order(_score desc)[0...10] ${PROJECTION}
`

// Fallback for when embeddings are not enabled on the dataset yet.
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
  } catch {
    // Embeddings not enabled (or semantic search unavailable) — fall back to
    // keyword matching so the page still works.
    return serverClient.fetch<SearchHit[]>(KEYWORD_QUERY, {term: `${q}*`})
  }
}
