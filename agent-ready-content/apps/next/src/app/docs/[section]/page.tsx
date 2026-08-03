import Link from 'next/link'
import {notFound} from 'next/navigation'
import {SECTION_QUERY} from '@agent-ready/markdown'
import {client} from '@/sanity/client'

export const revalidate = 60

export default async function SectionPage({params}: {params: Promise<{section: string}>}) {
  const {section: sectionSlug} = await params
  const section = await client.fetch(SECTION_QUERY, {sectionSlug}, {tag: 'html.section'})

  if (!section) notFound()

  return (
    <main>
      <h1>{section.title}</h1>
      {section.description && <p>{section.description}</p>}
      <ul>
        {section.articles.map((article) => (
          <li key={article._id}>
            <Link href={`/docs/${section.slug.current}/${article.slug.current}`}>
              {article.title}
            </Link>
            {article.summary && <p style={{margin: '0.25rem 0 0.75rem'}}>{article.summary}</p>}
          </li>
        ))}
      </ul>
    </main>
  )
}
