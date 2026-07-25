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
- One document: `*[_type == "article" && slug.current == $slug && language == $language][0]`

Slugs are shared across a document's locales, so the slug plus the language is
the identity. Project `"slug": slug.current` — the stored value is an object.

## The fallback decision

The only genuinely non-obvious logic in a localized frontend:

1. Query the requested locale.
2. If null and the requested locale is not the source language, decide **where to
   fall back to**. Each `l10n.locale` document carries a `fallback` reference, so
   pt-BR can fall back to pt-PT before en-US. Walking that chain is the richer
   behaviour and the schema supports it; the reference implementation is
   **single-hop** — it goes straight to the source language and ignores the chain.
   Whichever you pick, it is the site's job, not the Studio's.
3. Query the same slug in the chosen fallback locale.
4. If that resolves, render it **with a visible notice** that this is not a
   translation.
5. If it does not, 404.

`apps/frontend/src/app/[lang]/[slug]/page.tsx` does this in two fetches and one
banner (`FallbackBanner.tsx`).

## Three decisions to make deliberately

**Where the default locale comes from.** Deriving it from the locale documents
costs a query in the redirect path; hardcoding it costs a deploy when it changes.
The reference hardcodes it in two places, which is the worst of both — pick one
and keep it in one place.

**How strictly to match a locale segment.** A `xx-XX` regex is cheap and rejects
valid tags with script subtags (`zh-Hans-CN`). Validating against the fetched
locale codes, or with `Intl.Locale`, costs more and is correct.

**Whether the frontend is in the typegen path.** Sanity TypeGen only generates
result types for query files it is configured to scan (`sanity.cli.ts` in the
Studio). The reference frontend is outside it and hand-writes its result types,
which is why they contain `any`. Adding it to the typegen `path` is the better
answer for a real project.

## Non-negotiables

- **Read-only.** No write token in a frontend. A read token, if the dataset is
  private, stays server-side.
- **No Studio imports.** Nothing from `sanity`, `@sanity/ui` or the l10n Studio
  package belongs in a frontend bundle. Duplicate a small helper instead — the
  reference does exactly that in `LocaleSwitcher.tsx`, with a comment saying why.
- **Server-side fetching.** Keep the client and the token out of the browser
  bundle; the reference marks its wrapper `server-only`.
