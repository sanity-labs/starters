export interface Locale {
  code: string
  title: string
  nativeName: string | null
}

export interface ArticleCard {
  _id: string
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  language: string
  mainImage: any | null
}

export interface ArticleDetail extends ArticleCard {
  body: any[] | null
  author: {name: string} | null
}
