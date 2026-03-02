# Frontend

Next.js 15 frontend with path-based i18n routing. Renders localized content from Sanity with automatic locale detection, a locale switcher, and fallback banners when translations are missing.

## Quick Start

```bash
# From the monorepo root
pnpm install
pnpm dev
```

The frontend opens at [localhost:3000](http://localhost:3000).

For server-side data fetching with a private dataset, add a read token to the root `.env.local`:

```sh
echo 'SANITY_API_READ_TOKEN=your-token' >> .env.local
```

## How It Works

- **Routes** — `[lang]/page.tsx` (article list), `[lang]/[slug]/page.tsx` (article detail), `[lang]/architecture/page.tsx` (architecture overview)
- **Locale routing** — path prefix (`/en-US/`, `/de-DE/`) with middleware for cookie-based locale preference
- **Fallback content** — when a translation is missing, shows the source-language content with a banner indicating it's a fallback
- **Locale switcher** — dropdown that navigates between locale variants of the current page

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
├── sanity/
│   ├── client.ts               Sanity client setup
│   ├── fetch.ts                Server-side fetch wrapper
│   ├── queries.ts              GROQ queries for locales and articles
│   └── types.ts                TypeScript types for query results
├── components/
│   ├── LocaleSwitcher.tsx      Locale dropdown navigation
│   ├── ArticleCard.tsx         Article preview card
│   ├── FallbackBanner.tsx      "Viewing in fallback language" notice
│   └── PortableText.tsx        Portable Text renderer
└── proxy.ts                    Middleware for locale detection
```
