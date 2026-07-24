import Link from 'next/link'
import {notFound} from 'next/navigation'
import {PortableText} from '@portabletext/react'
import {ARTICLE_WITH_NAV_QUERY, prevNext} from '@agent-ready/markdown'
import {client} from '@/sanity/client'
import {components} from '@/components/PortableTextComponents'
import {CopyMarkdown} from '@/components/CopyMarkdown'

export const revalidate = 60

export default async function ArticlePage({
  params,
}: {
  params: Promise<{section: string; article: string}>
}) {
  const {section: sectionSlug, article: articleSlug} = await params
  const data = await client.fetch(
    ARTICLE_WITH_NAV_QUERY,
    {sectionSlug, articleSlug},
    {tag: 'html.article'},
  )

  if (!data.article) notFound()
  const {article} = data
  const {prevArticle, nextArticle} = prevNext(data.allArticles, articleSlug)

  return (
    <main>
      <p style={{fontSize: '0.875rem'}}>
        <Link href={`/docs/${sectionSlug}`}>{article.section.title}</Link>
      </p>
      <h1>{article.title}</h1>
      {article.summary && (
        <p>
          <em>{article.summary}</em>
        </p>
      )}
      <CopyMarkdown path={`/docs/${sectionSlug}/${articleSlug}.md`} />
      <PortableText value={article.content ?? []} components={components} />
      <footer
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
        }}
      >
        <span>
          {prevArticle && (
            <Link href={`/docs/${sectionSlug}/${prevArticle.slug.current}`}>
              ← {prevArticle.title}
            </Link>
          )}
        </span>
        <span>
          {nextArticle && (
            <Link href={`/docs/${sectionSlug}/${nextArticle.slug.current}`}>
              {nextArticle.title} →
            </Link>
          )}
        </span>
      </footer>
    </main>
  )
}
