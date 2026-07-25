# Framework-agnostic setup

What a frontend needs from the Studio side, and the three decisions no framework
makes for you. The Next.js implementation of all of it is
`apps/frontend/src/sanity/` and `apps/frontend/src/app/[lang]/` — read those for
working code.

## What the Studio side gives you

**`l10n.locale` documents.** `code` (BCP-47), `title`, `nativeName`, and a
`fallback` reference to another locale. These documents are the locale list — the
single source of truth, for the switcher, for static params, and for validating a
path segment. Always query them. A hardcoded array is wrong the first time an
editor adds a market, and it will be an editor who adds it, not you.

**A `language` field** on every document-tier localized type, holding a BCP-47
code. The Studio writes it; the frontend only filters on it. Only types passed to
`createL10n({localizedSchemaTypes})` have it.

**Language-keyed arrays** on field-tier types instead — `internationalizedArray`
values with `_key` set to the locale code. A frontend reads one by matching
`_key`, and there is no separate document to fetch.

## Queries

Three shapes cover a locale-aware frontend. Read
`apps/frontend/src/sanity/queries.ts` for the projections; these are the filters:

- All locales: `*[_type == "l10n.locale"] | order(title asc)`
- A list for one locale: `*[_type == "article" && language == $language]`
- One document: `*[_type == "article" && slug.current == $slug] | order(select(language == $language => 0, 1) asc)[0]`

**A slug belongs to one locale, not to the document.** German editors write German
slugs. So `slug.current == $slug && language == $language` answers only the case
where the requested locale happens to own the slug, and matching one locale's slug
against another's is the bug that produces cross-locale 404s. Ordering by the
requested language instead of filtering on it lets one query answer both cases,
and the same query carries the siblings:

```groq
"translations": *[_type == "translation.metadata" && references(^._id)][0]
  .translations[defined(value->slug.current)]
  .value->{"language": language, "slug": slug.current}
```

Project `"slug": slug.current` — the stored value is an object.

## The fallback decision

The only genuinely non-obvious logic in a localized frontend:

1. Resolve the slug. If the requested locale owns it, render.
2. If the requested locale has this document under a **different** slug, the URL
   is stale — redirect to that locale's own URL rather than falling back.
3. Otherwise decide **where to fall back to**. Each `l10n.locale` document carries
   a `fallback` reference, so pt-BR can fall back to pt-PT before en-US. Walk the
   chain hop by hop, stop on a cycle, and treat the source language as the last
   resort. It is the site's job, not the Studio's.
4. Render the first sibling the chain finds, **with a visible notice** that this
   is not a translation.
5. If the chain runs out, 404.

`apps/frontend/src/app/[lang]/[slug]/page.tsx` does this; the walk itself is
`apps/frontend/src/sanity/locales.ts`, and the notice is `FallbackBanner.tsx`.

## Cross-locale links and hreflang

The sibling list from the resolution query is the one source for three things: the
locale switcher's hrefs, `alternates.languages` plus `x-default` in the page
metadata, and the sitemap's per-entry alternates. Deriving any of them by string
surgery on the current URL reintroduces the shared-slug assumption.

A locale with no rendition of the current document links to its home page rather
than to a URL that will 404.

## Three decisions to make deliberately

**Where the default locale comes from.** Deriving it from the locale documents
costs a query in the redirect path; hardcoding it costs a deploy when it changes.
The reference hardcodes it, in one place (`queries.ts`) that everything else
imports — keep whichever you pick to one declaration.

**How strictly to match a locale segment.** A `xx-XX` regex is cheap and rejects
valid tags with script subtags (`zh-Hans-CN`). Validating against the fetched
locale codes, or with `Intl.Locale`, costs more and is correct.

**Where the frontend's generated types come from.** TypeGen only scans the query
files a `sanity.cli.ts` names, and extracting a schema needs a Studio config. The
reference keeps the frontend out of `studio/sanity.cli.ts`'s glob so it stays a
plain Next app you can lift out, and gives it a typegen-only
`apps/frontend/sanity.cli.ts` that reads the schema the Studio extracts. Widening
the Studio's glob is the other answer. Either way the result types are generated,
never hand-written — the generated `SanityQueries` augmentation is what gives
`sanityFetch` its typed `data`.

## Non-negotiables

- **Read-only.** No write token in a frontend. A read token, if the dataset is
  private, stays server-side.
- **No Studio imports.** Nothing from `sanity`, `@sanity/ui` or the l10n Studio
  package belongs in a frontend bundle. Duplicate a small helper instead — the
  reference does exactly that in `LocaleSwitcher.tsx`, with a comment saying why.
- **Server-side fetching.** Keep the client and the token out of the browser
  bundle; the reference marks `src/sanity/live.ts` `server-only`.
