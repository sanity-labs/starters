import Link from 'next/link'

import {searchContent} from '@/sanity/search'

type Props = {
  searchParams: Promise<{q?: string}>
}

export default async function SearchPage({searchParams}: Props) {
  const {q} = await searchParams
  const query = q?.trim() ?? ''
  const results = query ? await searchContent(query) : []

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <form action="/search" className="mb-8">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search the knowledge base…"
          className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-gray-500"
        />
      </form>

      {query && (
        <p className="mb-6 text-sm text-gray-500">
          {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
        </p>
      )}

      <ul className="space-y-5">
        {results.map((hit) => {
          const title = hit.title ?? hit.question ?? 'Untitled'
          const inner = (
            <>
              <span className="text-lg font-medium text-blue-600 hover:underline">{title}</span>
              <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">
                {hit._type === 'faq' ? 'FAQ' : 'Article'}
              </span>
              {hit.summary && <p className="mt-1 text-gray-600">{hit.summary}</p>}
            </>
          )
          return (
            <li key={hit._id}>
              {hit._type === 'helpArticle' && hit.slug ? (
                <Link href={`/articles/${hit.slug}`}>{inner}</Link>
              ) : (
                <div>{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
