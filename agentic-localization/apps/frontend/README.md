# Frontend

Next.js 16 frontend with path-based i18n routing. Renders localized content from Sanity with automatic locale detection, a locale switcher, and fallback banners when translations are missing.

## Quick Start

```bash
# From the monorepo root
pnpm install
pnpm dev
```

The frontend opens at [localhost:3000](http://localhost:3000).

Project ID and dataset come from the root `.env`. For server-side data fetching with a private dataset, add a read token to this workspace's `.env.local` — where `sanity init` puts it:

```sh
echo 'SANITY_API_READ_TOKEN=your-token' >> apps/frontend/.env.local
```

## How It Works

- **Caching** — Cache Components (`cacheComponents: true`). Every page body is a `'use cache'` boundary; `<SanityLive />` expires the cache tags `sanityFetch` writes, so published edits appear without a redeploy
- **Routes** — `[lang]/page.tsx` (article list), `[lang]/[slug]/page.tsx` (article detail), `[lang]/architecture/page.tsx` (architecture overview)
- **Locale routing** — path prefix (`/en-US/`, `/de-DE/`) with `proxy.ts` redirecting unprefixed paths using the `NEXT_LOCALE` cookie
- **Fallback content** — when a translation is missing, shows the source-language content with a banner indicating it's a fallback
- **Locale switcher** — dropdown that navigates between locale variants of the current page
- **Visual editing** — the Studio's Presentation tool previews this app; `/api/draft-mode/enable` validates its secret, and every page passes the resolved perspective into its `'use cache'` boundary. Overlays link to `SANITY_STUDIO_URL` (default `http://localhost:3333`)

## Architecture

Visit `/en-US/architecture` in the running app for a detailed architecture overview rendered as an interactive page.

## Key Files

```
src/
├── app/[lang]/
│   ├── layout.tsx              Root layout with locale switcher
│   ├── page.tsx                Article list
│   ├── [slug]/page.tsx         Article detail with Portable Text
│   └── architecture/page.tsx   Architecture documentation page
├── app/api/draft-mode/enable/
│   └── route.ts                Presentation's preview-mode entry point
├── sanity/
│   ├── live.ts                 Client, `defineLive` (sanityFetch, SanityLive), `resolvePreview`
│   ├── stega.ts                Which fields never carry edit overlays
│   ├── queries.ts              GROQ queries for locales and articles
│   └── types.ts                Query result types, wired into `sanityFetch`
├── components/
│   ├── LocaleSwitcher.tsx      Locale dropdown navigation
│   ├── ArticleCard.tsx         Article preview card
│   ├── FallbackBanner.tsx      "Viewing in fallback language" notice
│   └── PortableText.tsx        Portable Text renderer
└── proxy.ts                    Locale redirect (Next 16's middleware convention)
```
