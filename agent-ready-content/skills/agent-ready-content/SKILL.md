---
name: agent-ready-content
description: >
  Port the agent-ready content pattern (markdown routes, content negotiation,
  sitemap.md, llms.txt) from the agent-ready-content starter into an existing
  Sanity project. Use when someone wants their site's content served as
  markdown for AI agents, wants to add llms.txt, wants "Accept: text/markdown"
  content negotiation, or asks to make their docs or site agent-readable.
---

# Port agent-ready content into an existing project

You are adapting the agent-ready-content starter's delivery pattern onto a project that already has its own schema and frontend. Do not copy the starter's content model. The pattern has three parts, and they adopt independently: explicit `.md` routes (do this first, it carries the most value), discovery routes (`llms.txt`, `sitemap.md`), and `Accept` header negotiation (optional, needs care with CDNs).

## Step 1: Map the content model

Ask for (or read from the project):

- Which document types should be agent-readable, and which field holds the Portable Text body
- The URL structure of the existing HTML pages (you will mirror it for `.md`)
- Every custom block type inside the Portable Text arrays (code? image? video? embed? table?)

## Step 2: Copy and adapt packages/agent-markdown

Copy the package into the project (or its files into a `lib/` directory). Then:

1. Rewrite `queries.ts` against the project's types and slugs. Keep the two-tier split: navigation queries fetch title/slug/summary only, article queries fetch full content.
2. In `serializers.ts`, write one renderer per custom block type found in step 1. Follow the conventions: GFM alerts for callout-like types, `lang:filename` fences for code, CDN URLs for images. A type without a renderer is silently dropped from the output, so cover all of them.
3. Adapt the builders in `build.ts` to the project's URL structure. Keep the canonical URL line in article output.

## Step 3: Add routes for the project's framework

- **Next.js**: copy `apps/next/src/app/md/` handlers, `sitemap.md/route.ts`, `llms.txt/route.ts`, and the `rewrites` block from `next.config.ts`. Adjust segment names to the project's URL structure.
- **Astro**: copy the `.md.ts` endpoint files, `llms.txt.ts`, and `src/middleware.ts`. Header negotiation requires an SSR adapter; skip the middleware for static builds.
- **Other frameworks**: the builders return strings. Any framework that can return a `Response` with a `Content-Type: text/markdown; charset=utf-8` header can serve them. Mirror the rewrite/endpoint split that fits its router.

## Step 4: Verify

```bash
curl http://localhost:3000/<a-real-page>.md          # markdown, correct Content-Type
curl -H "Accept: text/markdown" http://localhost:3000/<a-real-page>   # same output
curl http://localhost:3000/llms.txt                   # H1, blockquote, H2 link lists
```

Check that the llms.txt links resolve, that custom blocks appear in the markdown (not silently dropped), and that no stega characters leak into the output (fetch with `stega: false` anywhere visual editing is enabled).

## Conventions to preserve

- `requestTagPrefix` on the client plus per-fetch tags (`md.article`, `llms.index`), so adoption is measurable
- Tiered cache headers: 60s/300s articles, 300s/600s navigation routes
- llms.txt links point at `.md` URLs, not HTML pages
- Summaries are the agent's decision surface: if the project's documents lack a summary field, recommend adding one rather than truncating body text

## References

Fetch these when you need to verify current APIs instead of trusting this file or your training data. The Learn URLs serve markdown when you append `.md`, which is the pattern you are porting.

- [llms.txt spec](https://llmstxt.org/index.md): the required file structure (H1, blockquote, H2 link lists, Optional section). Check before changing `buildLlmsTxt`.
- [Markdown Routes with Next.js course](https://www.sanity.io/learn/course/markdown-routes-with-nextjs.md): step-by-step walkthrough of the Next.js half. Known issue: its `portableTextToMarkdown` snippets show a `serializers: {...}` options wrapper; the shipped @portabletext/markdown API takes renderer maps directly (`{types: {...}}`). Trust the installed package's types.
- [@portabletext/markdown](https://www.npmjs.com/package/@portabletext/markdown): renderer signatures for custom block types.
- [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites): `beforeFiles` timing and `has` header matching.
- [Astro endpoints](https://docs.astro.build/en/guides/endpoints/) and [middleware](https://docs.astro.build/en/guides/middleware/): `.md.ts` file routing and the `next(path)` rewrite used for header negotiation.
- [Request tags in @sanity/client](https://www.sanity.io/docs/apis-and-sdks/js-client-request-tags): how `requestTagPrefix` and per-fetch tags surface in request logs.
