import type {ArticleQueryResult} from '@starter/sanity-types'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {PortableText} from 'next-sanity'

import {sanityFetch} from '@/sanity/live'
import {articleQuery, articleSlugsQuery} from '@/sanity/queries'

type Props = {
  params: Promise<{slug: string}>
}

export async function generateStaticParams() {
  const {data} = await sanityFetch({
    query: articleSlugsQuery,
    perspective: 'published',
    stega: false,
  })
  return data
}

export default async function ArticlePage(props: Props) {
  const params = await props.params
  const {data} = await sanityFetch({query: articleQuery, params})
  const article = data as ArticleQueryResult

  if (!article?._id) {
    return notFound()
  }

  return (
    <main className="mx-auto max-w-prose px-4 py-12">
      <Link href="/" className="mb-8 inline-block text-sm text-brand hover:text-brand-hover">
        Back to help center
      </Link>
      <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">Help article</p>
      <h1 className="mt-2 text-display-sm text-fg-base">{article.title}</h1>
      {article.summary && <p className="mt-4 text-body-md text-fg-muted">{article.summary}</p>}
      {article.content && (
        <div className="prose prose-neutral mt-8 max-w-none">
          <PortableText value={article.content} />
        </div>
      )}
    </main>
  )
}
