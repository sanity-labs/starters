import type {
  ARTICLE_QUERY_RESULT,
  ARTICLES_BY_LANGUAGE_QUERY_RESULT,
  LOCALES_QUERY_RESULT,
} from './sanity.types'

/**
 * The app's vocabulary, projected out of what TypeGen generated for each query
 * in `queries.ts`. Nothing here is hand-written: `sanity.types.ts` is generated
 * from `studio/schema.json` by this app's own `sanity.cli.ts`, and it carries
 * the `SanityQueries` augmentation that gives `sanityFetch` its typed `data`.
 *
 * GROQ cannot promise a field is set, so a projection is nullable wherever the
 * schema is. `Present` narrows the one shape the app only ever handles
 * complete; the guard that proves it is `listTranslations` in `locales.ts`.
 */
type Present<T> = {[K in keyof T]: NonNullable<T[K]>}

export type Locale = LOCALES_QUERY_RESULT[number]

/** One locale's rendition of a document: its own language, its own slug. */
export type Translation = Present<
  NonNullable<NonNullable<NonNullable<ARTICLE_QUERY_RESULT>['translations']>[number]>
>

export type ArticleCard = ARTICLES_BY_LANGUAGE_QUERY_RESULT[number]

export type ArticleResolution = NonNullable<ARTICLE_QUERY_RESULT>
