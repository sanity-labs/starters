# Shared Setup — Framework-Agnostic

Patterns that apply regardless of frontend framework. For the Next.js
implementation, read `apps/frontend/src/` directly.

## Environment Variables

| Variable   | Description                            | Framework prefix                                                      |
| ---------- | -------------------------------------- | --------------------------------------------------------------------- |
| Project ID | Sanity project ID                      | `NEXT_PUBLIC_` (Next.js), `PUBLIC_` (Astro/SvelteKit), `VITE_` (Vite) |
| Dataset    | Dataset name                           | Same prefix pattern                                                   |
| Read token | Read-only API token (server-side only) | `SANITY_API_READ_TOKEN` (no prefix — never expose to client)          |

## Sanity Client

For Next.js, use `createClient` from `next-sanity`. For other frameworks, use
`@sanity/client`. See `apps/frontend/src/sanity/client.ts` for the Next.js
version.

## Key Concepts

### The `language` field

A hidden, read-only string injected by the l10n plugin into every localized
document type. Stores a BCP-47 locale code (e.g., `"en-US"`, `"de-DE"`).
Managed by the Studio, not the frontend.

### The `l10n.locale` document type

Locales are Sanity documents with `_type: "l10n.locale"`. Each has `code`
(BCP-47), `title` (display name), and `nativeName` (name in the locale's own
language). Query these to build dynamic locale switchers — never hardcode locale
lists.

### Slug storage

Slugs are stored as `{ current: "the-slug", _type: "slug" }`. Always project
as `"slug": slug.current` in GROQ queries.

### Localized document types

Only types listed in `createL10n({localizedSchemaTypes: [...]})` have the
`language` field.

## GROQ Query Patterns

See `apps/frontend/src/sanity/queries.ts` for the complete queries. The key
patterns:

- **Filter by locale:** `*[_type == "article" && language == $language]`
- **Fetch locales:** `*[_type == "l10n.locale"] | order(title asc)`
- **Single doc by slug + locale:** `*[_type == "article" && slug.current == $slug && language == $language][0]`

## Fallback Content Pattern

When a translation is missing for the requested locale:

1. Query for the document with the requested locale
2. If null AND the locale is not the default language, query the same slug with
   the default language (`en-US`)
3. If a fallback is found, render it with a banner indicating the content is in
   the default language
4. If still null, show a 404

See `apps/frontend/src/app/[lang]/[slug]/page.tsx` for the Next.js
implementation.

## Design Principles

1. **Separate concerns** — Keep framework-agnostic Sanity code in `src/sanity/`.
   Framework-specific rendering goes in pages/components.
2. **Read-only frontend** — The frontend never mutates Sanity data. No write
   tokens, no Studio dependencies.
3. **Dynamic locales** — Always query `l10n.locale` documents instead of
   hardcoding. New locales added in the Studio appear automatically.
4. **Type safety** — Use `defineQuery()` (Next.js) or typed fetch wrappers.
