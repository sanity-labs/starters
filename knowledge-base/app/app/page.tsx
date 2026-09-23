import type {
  ArticlesQueryResult,
  ProductsQueryResult,
  TopicsQueryResult,
} from '@starter/sanity-types'
import Link from 'next/link'

import {HomeStory} from '@/components/home-story'
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
      <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">{label}</p>
      <Link
        href={href()}
        className={
          !active
            ? 'block text-sm font-medium text-brand'
            : 'block text-sm text-fg-muted hover:text-fg-base'
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
              ? 'block text-sm font-medium text-brand'
              : 'block text-sm text-fg-muted hover:text-fg-base'
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
  const articleList = articles.data as ArticlesQueryResult
  const productList = products.data as ProductsQueryResult
  const topicList = topics.data as TopicsQueryResult

  return (
    <main>
      <HomeStory />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 className="text-display-sm font-semibold text-fg-base">Published help articles</h2>
          <span className="font-mono text-caption uppercase tracking-wider text-fg-subtle">
            Browse
          </span>
        </div>
        <form action="/search" className="mb-8">
          <input
            name="q"
            placeholder="Search published articles and FAQs"
            className="w-full rounded-sm border border-border-base bg-bg-card px-4 py-2 text-sm outline-none focus:border-border-focus"
          />
        </form>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[12rem_1fr]">
          <aside className="space-y-6">
            <FilterGroup
              label="Product"
              terms={productList}
              param="product"
              active={product}
              other={{key: 'topic', value: topic}}
            />
            <FilterGroup
              label="Topic"
              terms={topicList}
              param="topic"
              active={topic}
              other={{key: 'product', value: product}}
            />
          </aside>

          <section>
            {articleList.length === 0 ? (
              <p className="text-fg-subtle">No articles match these filters.</p>
            ) : (
              <ul className="space-y-6">
                {articleList.map((article) => (
                  <li key={article._id}>
                    <Link
                      href={`/articles/${article.slug}`}
                      className="text-lg font-medium text-fg-base hover:text-brand"
                    >
                      {article.title}
                    </Link>
                    {article.summary && <p className="mt-1 text-fg-muted">{article.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
