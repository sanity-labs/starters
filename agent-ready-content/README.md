# agent-ready-content

Serve HTML to humans and markdown to agents from the same URLs.

This starter implements three delivery patterns from one Sanity dataset, in two frameworks:

1. **Explicit markdown URLs**: append `.md` to any docs URL
2. **Content negotiation**: the same URL returns markdown when the request sends `Accept: text/markdown`
3. **Agent discovery**: `/llms.txt` (per [llmstxt.org](https://llmstxt.org)) and `/sitemap.md` index everything, linking to the `.md` URLs

The Next.js app and the Astro app render the same content through one shared schema package and one shared markdown package. The pattern lives in the content structure, not in a framework feature.

## Quick start

```bash
pnpm install
pnpm dlx sanity login   # if you aren't already
pnpm bootstrap          # dataset, schema, seed content, CORS
pnpm dev
```

Then:

| URL                                                                              | What you get                         |
| -------------------------------------------------------------------------------- | ------------------------------------ |
| http://localhost:3000                                                            | Next.js docs site (HTML)             |
| http://localhost:4321                                                            | Astro docs site (HTML), same content |
| http://localhost:3333                                                            | Sanity Studio                        |
| `curl localhost:3000/docs/getting-started/quickstart.md`                         | markdown, explicit URL               |
| `curl -H "Accept: text/markdown" localhost:3000/docs/getting-started/quickstart` | markdown, negotiated                 |
| `curl localhost:3000/llms.txt`                                                   | agent entry point                    |
| `curl localhost:3000/sitemap.md`                                                 | full markdown index                  |

The same four curl commands work against port 4321.

If `pnpm bootstrap` fails partway, every step has a manual equivalent in [docs/manual-setup.md](docs/manual-setup.md).

## Layout

```text
studio/            Sanity Studio
apps/
  next/            Next.js: HTML pages + /md routes + rewrites
  astro/           Astro: HTML pages + .md endpoints + middleware
packages/
  schema/          section, article, code, callout document types
  agent-markdown/  Portable Text serializers, document builders, GROQ queries
seed/              Sample content (Keplar, a fictional geospatial API)
skills/            Claude Code skill for porting the pattern to existing projects
```

## How the markdown routes work

**Next.js** cannot put dynamic segments in filenames, so markdown is served by internal Route Handlers under `src/app/md/`, and `next.config.ts` rewrites map both the `.md` suffix and the `Accept` header onto them. `/sitemap.md` and `/llms.txt` are folders with those literal names.

**Astro** serves `.md` URLs directly from endpoint files (`[article].md.ts`), and `src/middleware.ts` rewrites negotiated requests onto the same endpoints. Header negotiation needs the server output mode (configured, with the Node adapter). If you deploy static, delete the middleware and keep the endpoints; the explicit URLs carry the pattern.

Everything that defines the markdown output lives in `packages/agent-markdown`. The apps contribute routing and nothing else, which is what makes the pattern portable to other frameworks.

## Adopting the pattern in an existing project

You don't need this starter's content model. [`skills/agent-ready-content/SKILL.md`](skills/agent-ready-content/SKILL.md) walks a coding agent through porting the pattern onto your existing schema: point the queries at your document types, map your custom blocks in the serializers, add the route files for your framework. By hand, budget roughly a day; the serializers for your custom blocks are the only part with real decisions in it.

## Type safety

Queries are wrapped in `defineQuery` and typed by Sanity TypeGen, so `client.fetch(QUERY)` returns generated result types with no manual generics. After changing the schema or a query, run `pnpm typegen` to regenerate `packages/agent-markdown/src/sanity.types.ts` (gitignored; `pnpm bootstrap` and `pretypecheck` generate it when missing). Extraction runs with `--enforce-required-fields`, so fields with required validation come out non-nullable.

## Instrumentation

Both apps create their Sanity client with `requestTagPrefix: 'agent-content'` and tag every fetch with its surface (`md.article`, `md.section`, `md.sitemap`, `llms.index`, `html.*`). Filter your project's request logs on these tags to measure markdown adoption against HTML traffic.

## Caching

| Route                      | Cache-Control                                     |
| -------------------------- | ------------------------------------------------- |
| Article markdown           | `public, max-age=60, stale-while-revalidate=300`  |
| Section, sitemap, llms.txt | `public, max-age=300, stale-while-revalidate=600` |

The rewrite approach keeps `Accept` negotiation mostly out of CDN cache keys (negotiated requests rewrite to distinct internal routes before the cache key forms), but test on your CDN before trusting it in production.

## Related

- Guide: agent-ready content in the [AI content operations series](https://www.sanity.io/resources/ai-content-operations)
- Step-by-step course: [Markdown Routes with Next.js](https://www.sanity.io/learn/course/markdown-routes-with-nextjs) on Sanity Learn
- Spec: [llmstxt.org](https://llmstxt.org)
