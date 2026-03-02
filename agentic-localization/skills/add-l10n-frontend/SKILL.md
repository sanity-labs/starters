---
name: add-l10n-frontend
description: 'Add localized content rendering to a frontend project using the Sanity l10n plugin. The starter includes a complete Next.js reference implementation at apps/frontend/ — use this skill to understand those patterns, adapt them, or scaffold a frontend for a different framework (Astro, SvelteKit). Trigger on: add frontend, localized rendering, i18n routing, locale switcher, fallback content, frontend translation.'
---

# Add Localized Frontend Rendering

## What This Skill Covers

This starter already includes a complete Next.js frontend at `apps/frontend/`.
This skill helps you:

1. **Understand the existing implementation** — read `apps/frontend/` as the
   canonical reference for how path-based i18n routing, locale switching, and
   fallback content work with the l10n plugin.
2. **Scaffold a frontend for a different framework** — apply the same patterns
   to Astro, SvelteKit, or another framework using the shared setup reference.

## Prerequisites

1. **Sanity project with l10n plugin** — Locales exist as `l10n.locale`
   documents in the dataset.
2. **Localized document types** — Document types (e.g. `article`) have a
   `language` field injected by the l10n plugin.

## If Using Next.js

The implementation already exists. Read these files directly:

| File                                              | What it demonstrates                                |
| ------------------------------------------------- | --------------------------------------------------- |
| `apps/frontend/src/sanity/client.ts`              | Sanity client setup with `next-sanity`              |
| `apps/frontend/src/sanity/fetch.ts`               | Server-only fetch wrapper (no `defineLive`)         |
| `apps/frontend/src/sanity/queries.ts`             | GROQ queries filtered by locale                     |
| `apps/frontend/src/sanity/types.ts`               | TypeScript types for query results                  |
| `apps/frontend/src/proxy.ts`                      | Middleware: redirects `/` to `/{preferred locale}`  |
| `apps/frontend/src/app/[lang]/layout.tsx`         | Root layout with `<html lang>`, locale switcher     |
| `apps/frontend/src/app/[lang]/page.tsx`           | Article list filtered by locale                     |
| `apps/frontend/src/app/[lang]/[slug]/page.tsx`    | Article detail with fallback logic                  |
| `apps/frontend/src/components/LocaleSwitcher.tsx` | Path-based locale switching with cookie persistence |
| `apps/frontend/src/components/FallbackBanner.tsx` | Fallback language notice                            |
| `apps/frontend/src/components/PortableText.tsx`   | Portable Text renderer                              |

Visit `/en-US/architecture` in the running frontend for an interactive
architecture overview.

Do NOT recreate these files — modify the existing ones.

## If Using a Different Framework

### Step 1 — Load Reference

Read `references/shared-setup.md` for the framework-agnostic patterns: Sanity
client setup, GROQ queries, TypeScript types, the fallback content pattern, and
design principles.

### Step 2 — Adapt the Patterns

Apply the shared patterns using your framework's conventions:

| Concern         | Next.js (reference)          | Astro               | SvelteKit            |
| --------------- | ---------------------------- | ------------------- | -------------------- |
| Client          | `next-sanity` `createClient` | `@sanity/client`    | `@sanity/client`     |
| Env prefix      | `NEXT_PUBLIC_`               | `PUBLIC_`           | `PUBLIC_`            |
| Routing         | `app/[lang]/` file-based     | `src/pages/[lang]/` | `src/routes/[lang]/` |
| SSR fetch       | `server-only` module         | Astro frontmatter   | `+page.server.ts`    |
| Locale redirect | `middleware.ts`              | Astro middleware    | `hooks.server.ts`    |

### Step 3 — Implement

Read the Next.js source files listed above for implementation patterns, then
adapt them to your framework. The core logic is the same:

1. **Locale routing** — path prefix (`/en-US/slug`, `/de-DE/slug`)
2. **Locale switcher** — swap the path segment, persist preference in a cookie
3. **Fallback content** — try target locale, fall back to default, show banner
4. **Dynamic locales** — query `l10n.locale` documents, never hardcode

### Step 4 — Verify

1. Dev server starts without errors
2. `/` redirects to `/{defaultLocale}/`
3. Locale switcher changes URL and content
4. Missing translations show fallback banner
5. New locales added in Studio appear automatically

## Extending This Skill

To add a framework-specific reference:

1. Create `references/<framework>-setup.md` covering framework-specific routing,
   data fetching, and middleware patterns.
2. Add the framework's config file pattern to the adaptation table above.
3. No changes needed to `shared-setup.md` or the workflow steps.

## Companion Skills

- **sanity-l10n** — The l10n plugin, prompt assembly, glossaries, style guides,
  evals, and serverless functions
- **sanity-best-practices** — General i18n patterns: document-level vs
  field-level
