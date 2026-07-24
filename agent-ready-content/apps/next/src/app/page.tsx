import Link from 'next/link'
import {SITEMAP_QUERY} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {SITE_INFO} from '@/lib/config'

export const revalidate = 60

export default async function HomePage() {
  const sections = await client.fetch(SITEMAP_QUERY, {}, {tag: 'html.home'})

  return (
    <main>
      <h1>{SITE_INFO.title}</h1>
      <p>{SITE_INFO.summary}</p>
      <p>
        Every page here is also served as markdown: append <code>.md</code> to any URL, or send{' '}
        <code>Accept: text/markdown</code>. Agents start at <a href="/llms.txt">/llms.txt</a>.
      </p>
      {sections.map((section) => (
        <section key={section._id}>
          <h2>
            <Link href={`/docs/${section.slug.current}`}>{section.title}</Link>
          </h2>
          {section.description && <p>{section.description}</p>}
          <ul>
            {section.articles.map((article) => (
              <li key={article._id}>
                <Link href={`/docs/${section.slug.current}/${article.slug.current}`}>
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
