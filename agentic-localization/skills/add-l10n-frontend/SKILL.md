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
   locale, all sharing a slug: `slug.current == $slug && language == $language`.
   Field-tier types instead carry language-keyed arrays, which the frontend reads
   by picking the matching `_key`.
4. **An explicit fallback, surfaced.** A missing translation renders the source
   language _and says so_. Silent fallback looks like a bug to the reader and
   hides coverage gaps from the team.
5. **Read-only.** No write token, no Studio imports, no mutations.

## The Next.js reference

Already implemented. Modify these files rather than recreating them.

| File                                                 | What it does                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/proxy.ts`                         | Next 16 proxy (the old `middleware.ts` convention): unprefixed path → 307 to `/{locale}`, reading the `NEXT_LOCALE` cookie |
| `apps/frontend/src/sanity/fetch.ts`                  | `server-only` fetch wrapper; builds its own client, no `defineLive`                                                        |
| `apps/frontend/src/sanity/queries.ts`                | `defineQuery` GROQ, locale-filtered, plus the fallback query and `DEFAULT_LANGUAGE`                                        |
| `apps/frontend/src/sanity/types.ts`                  | Hand-written result types — the frontend is outside the typegen path                                                       |
| `apps/frontend/src/sanity/client.ts`                 | A tagged client, currently unused by anything                                                                              |
| `apps/frontend/src/app/[lang]/layout.tsx`            | `<html lang>`, nav, locale switcher; `generateStaticParams` from the locale query                                          |
| `apps/frontend/src/app/[lang]/page.tsx`              | Article list for the locale                                                                                                |
| `apps/frontend/src/app/[lang]/[slug]/page.tsx`       | Detail view, and the fallback decision                                                                                     |
| `apps/frontend/src/components/LocaleSwitcher.tsx`    | Swaps the first path segment, persists `NEXT_LOCALE`, flags via `Intl.Locale`                                              |
| `apps/frontend/src/components/FallbackBanner.tsx`    | The "this is the source language" notice                                                                                   |
| `apps/frontend/src/components/PortableText.tsx`      | Portable Text renderer                                                                                                     |
| `apps/frontend/src/app/[lang]/architecture/page.tsx` | An in-app illustrated tour. Prose, not a source of truth — parts of it lag the code                                        |

Two known rough edges worth fixing rather than copying: `DEFAULT_LANGUAGE` is
hardcoded in both `queries.ts` and `proxy.ts` rather than derived from the locale
documents, and `proxy.ts` matches locales with `/^[a-z]{2}-[A-Z]{2}$/`, which
rejects script subtags like `zh-Hans-CN` that `LocaleSwitcher` handles correctly
via `Intl.Locale`.

## Porting to another framework

Read `references/shared-setup.md` for the framework-agnostic parts — the shape of
the queries, the fallback decision, and the two Studio conventions the frontend
depends on. Then map four concerns onto your framework:

| Concern         | Next.js (reference)  | Astro               | SvelteKit            |
| --------------- | -------------------- | ------------------- | -------------------- |
| Client          | `next-sanity`        | `@sanity/client`    | `@sanity/client`     |
| Public env      | `NEXT_PUBLIC_`       | `PUBLIC_`           | `PUBLIC_`            |
| Locale route    | `app/[lang]/`        | `src/pages/[lang]/` | `src/routes/[lang]/` |
| Server fetch    | `server-only` module | frontmatter         | `+page.server.ts`    |
| Locale redirect | `src/proxy.ts`       | middleware          | `hooks.server.ts`    |

Verify by behaviour, not by file count:

1. `/` redirects to the default locale.
2. Switching locale changes both URL and rendered content.
3. A document translated into only some locales renders the fallback plus its
   banner in the others, and 404s when the source is missing too.
4. Adding an `l10n.locale` document in the Studio makes a new locale reachable
   without a code change.

## Companion skills

- **sanity-l10n** — the localization pipeline: context as content, prompt
  assembly, workflow runs, review, the distillation loop.
- **sanity-best-practices** — general Sanity i18n modelling.
