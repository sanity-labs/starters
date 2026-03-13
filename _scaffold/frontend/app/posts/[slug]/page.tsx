import Link from 'next/link'
import {notFound} from 'next/navigation'
import {PortableText} from 'next-sanity'

import {sanityFetch} from '@/sanity/live'
import {postQuery, postSlugsQuery} from '@/sanity/queries'

type Props = {
  params: Promise<{slug: string}>
}

export async function generateStaticParams() {
  const {data} = await sanityFetch({
    query: postSlugsQuery,
    perspective: 'published',
    stega: false,
  })
  return data
}

export default async function PostPage(props: Props) {
  const params = await props.params
  const {data: post} = await sanityFetch({query: postQuery, params})

  if (!post?._id) {
    return notFound()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">
        &larr; Back to posts
      </Link>
      <h1 className="text-4xl font-bold mb-8">{post.title}</h1>
      {post.body && (
        <div className="prose">
          <PortableText value={post.body} />
        </div>
      )}
    </main>
  )
}
