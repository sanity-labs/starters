import Link from 'next/link'

import {sanityFetch} from '@/sanity/live'
import {articlesQuery, productsQuery, topicsQuery} from '@/sanity/queries'

type Props = {
  searchParams: Promise<{product?: string; topic?: string}>
}

type Term = {_id: string; title: string | null; slug: string | null}

function FilterGroup({
  label,
  terms,
  param,
  active,
  other,
}: {
  label: string
  terms: Term[]
  param: 'product' | 'topic'
  active?: string
  other: {key: string; value?: string}
}) {
  const href = (value?: string) => {
    const params = new URLSearchParams()
    if (value) params.set(param, value)
    if (other.value) params.set(other.key, other.value)
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <Link
        href={href()}
        className={
          !active
            ? 'block text-sm font-medium text-blue-600'
            : 'block text-sm text-gray-600 hover:text-gray-900'
        }
      >
        All
      </Link>
      {terms.map((t) => (
        <Link
          key={t._id}
          href={href(t.slug ?? undefined)}
          className={
            active === t.slug
              ? 'block text-sm font-medium text-blue-600'
              : 'block text-sm text-gray-600 hover:text-gray-900'
          }
        >
          {t.title}
        </Link>
      ))}
    </div>
  )
}

export default async function HomePage({searchParams}: Props) {
  const {product, topic} = await searchParams

  const [articles, products, topics] = await Promise.all([
    sanityFetch({query: articlesQuery, params: {product: product ?? null, topic: topic ?? null}}),
    sanityFetch({query: productsQuery}),
    sanityFetch({query: topicsQuery}),
  ])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Help Center</h1>
      <p className="mb-8 text-gray-600">
        Browse articles, or{' '}
        <Link href="/chat" className="text-blue-600 hover:underline">
          ask the AI assistant
        </Link>
        .
      </p>

      <form action="/search" className="mb-8">
        <input
          name="q"
          placeholder="Search the knowledge base…"
          className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-gray-500"
        />
      </form>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[12rem_1fr]">
        <aside className="space-y-6">
          <FilterGroup
            label="Product"
            terms={products.data}
            param="product"
            active={product}
            other={{key: 'topic', value: topic}}
          />
          <FilterGroup
            label="Topic"
            terms={topics.data}
            param="topic"
            active={topic}
            other={{key: 'product', value: product}}
          />
        </aside>

        <section>
          {articles.data.length === 0 ? (
            <p className="text-gray-500">No articles match these filters.</p>
          ) : (
            <ul className="space-y-6">
              {articles.data.map((article) => (
                <li key={article._id}>
                  <Link
                    href={`/articles/${article.slug}`}
                    className="text-lg font-medium text-blue-600 hover:underline"
                  >
                    {article.title}
                  </Link>
                  {article.summary && <p className="mt-1 text-gray-600">{article.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
