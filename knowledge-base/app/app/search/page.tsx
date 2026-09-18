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
          placeholder="Search published articles and FAQs"
          className="w-full rounded-sm border border-border-base bg-bg-card px-4 py-2 text-sm outline-none focus:border-border-focus"
        />
      </form>

      {query && (
        <p className="mb-6 font-mono text-micro uppercase tracking-wide text-fg-subtle">
          {results.length} result{results.length === 1 ? '' : 's'} for {query}
        </p>
      )}

      <ul className="space-y-5">
        {results.map((hit) => {
          const title = hit.title ?? hit.question ?? 'Untitled'
          const inner = (
            <>
              <span className="text-lg font-medium text-fg-base hover:text-brand">{title}</span>
              <span className="ml-2 font-mono text-micro uppercase tracking-wide text-fg-subtle">
                {hit._type === 'faq' ? 'FAQ' : 'Article'}
              </span>
              {hit.summary && <p className="mt-1 text-fg-muted">{hit.summary}</p>}
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
