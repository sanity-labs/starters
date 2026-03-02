# Next.js Reference Implementation

The complete Next.js implementation lives at `apps/frontend/`. Read the source
files directly rather than duplicating code here.

## Key Files

| File                                              | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `apps/frontend/src/sanity/client.ts`              | Sanity client via `next-sanity`                      |
| `apps/frontend/src/sanity/fetch.ts`               | Server-only fetch wrapper                            |
| `apps/frontend/src/sanity/queries.ts`             | GROQ queries with `defineQuery()`                    |
| `apps/frontend/src/sanity/types.ts`               | TypeScript interfaces                                |
| `apps/frontend/src/proxy.ts`                      | Middleware for locale redirect                       |
| `apps/frontend/src/app/[lang]/layout.tsx`         | Root layout, locale switcher, `generateStaticParams` |
| `apps/frontend/src/app/[lang]/page.tsx`           | Article list by locale                               |
| `apps/frontend/src/app/[lang]/[slug]/page.tsx`    | Article detail with fallback                         |
| `apps/frontend/src/components/LocaleSwitcher.tsx` | Path-swapping locale picker                          |
| `apps/frontend/src/components/FallbackBanner.tsx` | "Viewing in fallback language" notice                |
| `apps/frontend/src/components/PortableText.tsx`   | Portable Text renderer                               |
| `apps/frontend/src/components/ArticleCard.tsx`    | Article preview card                                 |

## Dependencies

Runtime: `next` (^15), `next-sanity`, `react` (^19), `react-dom` (^19),
`@portabletext/react`, `@sanity/image-url`, `@tailwindcss/typography`

Dev: `tailwindcss` (^4), `@tailwindcss/postcss`, `postcss`, `typescript`,
`@types/react`, `@types/react-dom`

## Implementation Notes

These are patterns to understand, not code to copy:

### Data fetching

Uses a `server-only` fetch wrapper (`src/sanity/fetch.ts`), NOT `defineLive()`
or `SanityLive`. The wrapper creates a server client with the read token and
`useCdn: false`.

### Routing

Path-based locale prefixes (`/en-US/slug`, `/de-DE/slug`). All pages nest under
`app/[lang]/`. In Next.js 15, `params` is a Promise and must be awaited.

### Middleware

Redirects bare paths to `/{preferred locale}`. Reads a `NEXT_LOCALE` cookie set
by the locale switcher; falls back to `en-US` for first-time visitors.

### Fallback content

Detail page queries the target locale first. If null and not the default
language, retries with `en-US`. Renders a `FallbackBanner` when showing fallback
content.

### Locale switcher

Client component that reads the current locale from the URL path, swaps the
path segment on click, and persists the choice in a `NEXT_LOCALE` cookie.

### Static generation

`generateStaticParams` in the layout queries `l10n.locale` documents to generate
a page per locale at build time.
