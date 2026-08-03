import type {ArticleRef} from './types'

/**
 * Find the previous and next articles for footer navigation,
 * given the ordered sibling list from ARTICLE_WITH_NAV_QUERY.
 */
export function prevNext(
  allArticles: ArticleRef[],
  articleSlug: string,
): {prevArticle?: ArticleRef; nextArticle?: ArticleRef} {
  const index = allArticles.findIndex((a) => a.slug.current === articleSlug)
  if (index === -1) return {}
  return {
    prevArticle: index > 0 ? allArticles[index - 1] : undefined,
    nextArticle: index < allArticles.length - 1 ? allArticles[index + 1] : undefined,
  }
}
