import type {SanityImageSource} from '@sanity/image-url/lib/types/types'
import type {PortableTextBlock} from '@portabletext/react'

// Hand-written result shapes for the card/detail projections so the app
// type-checks without a connected project. After `pnpm typegen` you can switch
// to the generated `*_QUERYResult` types in `@starter/sanity-types`.
export type ArticleCardData = {
  _id: string
  title: string | null
  slug: string | null
  dek: string | null
  date: string | null
  category: string | null
  authors: Array<string | null> | null
  image: SanityImageSource | null
  readingTimeMinutes: number | null
}

export type ArticleData = ArticleCardData & {
  body: PortableTextBlock[] | null
  sourceUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export function readingTimeLabel(minutes: number | null | undefined): string {
  return `${Math.max(1, Math.round(minutes ?? 1))} min read`
}

export function formatAuthors(authors: ArticleCardData['authors']): string {
  return (authors ?? []).filter(Boolean).join(' & ')
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
