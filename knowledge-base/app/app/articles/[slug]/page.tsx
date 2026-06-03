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
  const {data: article} = await sanityFetch({query: articleQuery, params})

  if (!article?._id) {
    return notFound()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">
        &larr; Back to help center
      </Link>
      <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
      {article.summary && <p className="text-lg text-gray-600 mb-8">{article.summary}</p>}
      {article.content && (
        <div className="prose">
          <PortableText value={article.content} />
        </div>
      )}
    </main>
  )
}
