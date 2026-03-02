import Link from 'next/link'
import type {ArticleCard as ArticleCardType} from '@/sanity/types'

export function ArticleCard({article, lang}: {article: ArticleCardType; lang: string}) {
  return (
    <Link
      href={`/${lang}/${article.slug}`}
      className="group block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-xl p-5 transition-all duration-[var(--transition-fast)] hover:border-[var(--color-accent)]/20 hover:shadow-[0_2px_20px_rgba(37,99,235,0.06)]"
    >
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)]">
        {article.title}
      </h2>
      {article.excerpt && (
        <p className="text-[var(--color-text-secondary)] mt-2 leading-relaxed">{article.excerpt}</p>
      )}
      {article.publishedAt && (
        <time className="text-sm text-[var(--color-text-muted)] mt-3 block">
          {new Date(article.publishedAt).toLocaleDateString()}
        </time>
      )}
    </Link>
  )
}
