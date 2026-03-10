import Link from 'next/link'

import {sanityFetch} from '@/sanity/live'
import {allPostsQuery} from '@/sanity/queries'

export default async function HomePage() {
  const {data: posts} = await sanityFetch({query: allPostsQuery})

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Posts</h1>
      <ul className="space-y-4">
        {posts.map((post: {_id: string; title: string | null; slug: string | null}) => (
          <li key={post._id}>
            <Link href={`/posts/${post.slug}`} className="text-lg text-blue-600 hover:underline">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
