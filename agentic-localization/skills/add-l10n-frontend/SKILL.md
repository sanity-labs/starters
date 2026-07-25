---
name: add-l10n-frontend
description: "Render localized Sanity content in a frontend: locale-prefixed routing, a locale switcher driven by l10n.locale documents, and fallback to the source language when a translation is missing. Use this skill when adding localized rendering to a web app, when reading the starter's Next.js reference at apps/frontend/ to adapt or extend it, or when porting those patterns to Astro, SvelteKit, Nuxt or another framework. Also use it for a site query returning every language at once — how a page query filters on the language field, and whether a slug is shared across a document's locales. Triggers on localized frontend, locale routing, /[lang]/ routes, locale switcher, language switcher, missing translation fallback, fallback banner, rendering translated content, querying content by locale. DO NOT use for the localization pipeline itself — glossaries, style guides, prompt assembly, Agent Actions translation, workflow runs, review gates, Functions or blueprints — that is sanity-l10n. DO NOT use for general Sanity internationalization content modelling — document-level vs field-level, plugin choice, language field design — that is sanity-best-practices."
---

# Localized Frontend Rendering

The frontend's job in this pattern is small and read-only: pick a locale from the
URL, query content filtered by that locale, fall back to the source language when
a translation is missing, and let a person switch.

`apps/frontend/` is a complete Next.js reference. It takes **no workspace
dependency** on the l10n packages — deliberately, so it can be lifted out as a
plain Next app. Its only coupling to the Studio is by convention: the
`l10n.locale` document type and the `language` field name.

## What the pattern requires of a frontend

1. **Locale in the path**, one segment: `/de-DE/article-slug`. A cookie or header
   alone gives you no shareable URL and no per-locale caching.
2. **Locales queried, not hardcoded.** `*[_type == "l10n.locale"]` — a new market
   appears when an editor adds a document, without a deploy.
3. **Content filtered by `language`.** The document tier stores one document per
   locale, **each with its own slug** — resolve a cross-locale link through
   `translation.metadata`, never by reusing the current locale's slug. Field-tier
   types instead carry language-keyed arrays, read by matching `_key`.
4. **An explicit fallback, surfaced.** A missing translation renders the locale's
   fallback _and says so_. Silent fallback looks like a bug to the reader and
   hides coverage gaps from the team.
5. **Read-only.** No write token, no Studio imports, no mutations.

## The Next.js reference

Already implemented. Modify these files rather than recreating them.

| File                                                 | What it does                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/proxy.ts`                         | Next 16 proxy (the old `middleware.ts` convention): unprefixed path → 307 to `/{locale}`, reading the `NEXT_LOCALE` cookie |
| `apps/frontend/src/sanity/live.ts`                   | The client and `defineLive({strict: true})` — `sanityFetch` and `<SanityLive />`, `server-only`                            |
| `apps/frontend/src/sanity/queries.ts`                | `defineQuery` GROQ: the locale list, the article resolution query, the sitemap query, `DEFAULT_LANGUAGE`                   |
| `apps/frontend/src/sanity/locales.ts`                | Fallback-chain walk (multi-hop, cycle-safe) and the sibling list for a document                                            |
| `apps/frontend/src/sanity/types.ts`                  | The app's vocabulary, projected out of the generated `sanity.types.ts` and its `SanityQueries` augmentation                |
| `apps/frontend/src/app/[lang]/layout.tsx`            | `<html lang>`, `metadataBase`, `<SanityLive />`; `generateStaticParams` from the locale query                              |
| `apps/frontend/src/app/[lang]/page.tsx`              | Article list for the locale                                                                                                |
| `apps/frontend/src/app/[lang]/[slug]/page.tsx`       | Detail view: slug resolution, stale-URL redirect, the fallback decision, hreflang metadata                                 |
| `apps/frontend/src/app/sitemap.ts`                   | Per-locale entries with `alternates.languages`                                                                             |
| `apps/frontend/src/components/SiteNav.tsx`           | Nav rendered per page — only a page knows the current document's slug in the other locales                                 |
| `apps/frontend/src/components/LocaleSwitcher.tsx`    | Links each locale to its own slug, persists `NEXT_LOCALE`, flags via `Intl.Locale`                                         |
| `apps/frontend/src/components/FallbackBanner.tsx`    | The "this is not a translation" notice                                                                                     |
| `apps/frontend/src/components/PortableText.tsx`      | Portable Text renderer                                                                                                     |
| `apps/frontend/src/app/[lang]/architecture/page.tsx` | An in-app illustrated tour. Prose, not a source of truth — parts of it lag the code                                        |

Every page body is a `'use cache'` boundary (`cacheComponents: true`), and
`sanityFetch` calls `cacheTag`/`cacheLife` — so it only works inside one. Read
`draftMode()` and `cookies()` outside the boundary and pass the result in.

Two known rough edges worth fixing rather than copying: `DEFAULT_LANGUAGE` is
hardcoded in `queries.ts` — one declaration, imported everywhere, but still not
derived from the locale documents — and `LOCALE_PATTERN` in
`apps/frontend/src/negotiateLocale.ts` matches `/^[a-z]{2}-[A-Z]{2}$/`, which
rejects script subtags like `zh-Hans-CN` that `LocaleSwitcher` handles correctly
via `Intl.Locale`.

## Porting to another framework

Read `references/shared-setup.md` for the framework-agnostic parts — the shape of
the queries, the fallback decision, and the two Studio conventions the frontend
depends on. Then map five concerns onto your framework:

| Concern         | Next.js (reference)  | Astro               | SvelteKit            |
| --------------- | -------------------- | ------------------- | -------------------- |
| Client          | `next-sanity`        | `@sanity/client`    | `@sanity/client`     |
| Public env      | `NEXT_PUBLIC_`       | `PUBLIC_`           | `PUBLIC_`            |
| Locale route    | `app/[lang]/`        | `src/pages/[lang]/` | `src/routes/[lang]/` |
| Server fetch    | `server-only` module | frontmatter         | `+page.server.ts`    |
| Locale redirect | `src/proxy.ts`       | middleware          | `hooks.server.ts`    |

Verify by behaviour, not by file count:

1. `/` redirects to the default locale.
2. Switching locale on a translated document lands on **that locale's slug**, not
   a 404 built from the current locale's slug.
3. A document translated into only some locales renders the fallback plus its
   banner in the others, and 404s when the chain runs out.
4. Adding an `l10n.locale` document in the Studio makes a new locale reachable
   without a code change.
5. Each page emits a per-locale canonical and `hreflang` alternates pointing at
   each sibling's own URL, plus `x-default`.

## Companion skills

- **sanity-l10n** — the localization pipeline: context as content, prompt
  assembly, workflow runs, review, the distillation loop.
- **sanity-best-practices** — general Sanity i18n modelling.
