---
name: add-scoped-agent-surface
description: Add a new scoped AI surface (audience) to a Sanity knowledge base — an Agent Context config that filters which content an agent can see, plus a server-side chat endpoint that holds the token. Use when adding a partner portal, reseller view, regional surface, or any new audience to this starter, or when applying the one-dataset-many-surfaces pattern to an existing Sanity project.
---

# Add a Scoped Agent Surface

One governed dataset can feed any number of AI surfaces, each seeing only the content meant for its audience. This starter ships two — an external help center (`customer-support`) and an internal staff tool (`team-kb`) — and the pattern extends to more: partners, resellers, regions, tiers.

A surface is four things:

1. A **`sanity.agentContext` document** — the contract: a GROQ filter scoping which documents the agent can see, plus instructions tuning how it queries
2. A **read token** held server-side (the dataset is private; no token ever reaches the browser)
3. An **MCP URL** addressing that config: `https://api.sanity.io/v2025-03-01/agent-context/<projectId>/<dataset>/<slug>`
4. A **server-side chat endpoint** that connects the LLM to that MCP URL

## Workflow

### Step 1: Create the Agent Context document

Add it to the seed generator (`studio/scripts/generate-seed.ts`) or create it directly in the dataset. The two shipped configs are the reference:

```ts
{
  _id: 'agentContext.partner',
  _type: 'sanity.agentContext',
  version: '1',
  name: 'Partner Portal',
  slug: {_type: 'slug', current: 'partner-portal'},
  groqFilter: '_type in ["helpArticle", "faq", "playbook", "product", "topic"]',
  instructions: PARTNER_INSTRUCTIONS,
}
```

- `groqFilter` is the access boundary — only matching documents are visible through this surface. It can filter on any field, not just `_type` (e.g. `audience` arrays, `status == "published"`).
- `instructions` is a system-prompt addendum the MCP serves to the agent: describe the content model, which types answer which questions, and how documents reference each other. Copy the structure of `EXTERNAL_INSTRUCTIONS` / `INTERNAL_INSTRUCTIONS` in the seed generator.

Publish the document (seed import publishes it; a draft is invisible to MCP).

### Step 2: Deploy the Studio

Agent Context MCP requires a **deployed Studio** — a deployed schema alone returns JSON-RPC error `-32004`.

```sh
pnpm --filter studio exec sanity deploy
```

### Step 3: Mint a read token for the surface

One token per surface keeps the security story clean (revoke one surface without touching the others):

```sh
pnpm --filter studio exec sanity tokens add "Partner surface" --role viewer --project-id <id> --json -y
```

The token is in the `.key` field of the JSON output. Put it in the env file of whatever server hosts the chat endpoint — never in browser-bundled env vars (anything `NEXT_PUBLIC_*` / `SANITY_APP_*` ships to the client).

### Step 4: Wire the chat endpoint

Pick the host based on where the UI lives:

- **UI in a server-backed app (Next.js):** copy `app/app/api/chat/route.ts` — `createMCPClient` (http transport, Bearer token) + `streamText` + a `displayCards` UI tool, capped with `stepCountIs(8)`.
- **UI in a browser-only app (App SDK, SPA):** copy `dashboard-server/src/index.ts` — same pattern behind a small Hono proxy with CORS locked to the UI origin. The App SDK has no server and cannot hold secrets; the proxy is the secret boundary.

Point the endpoint at the new surface via env:

```sh
SANITY_AGENT_CONTEXT_URL=https://api.sanity.io/v2025-03-01/agent-context/<projectId>/<dataset>/partner-portal
SANITY_READ_TOKEN_PARTNER=sk...
```

### Step 5: Verify

List the MCP tools directly (note the dual `Accept` header — the endpoint requires it; the AI SDK sets it automatically):

```sh
curl -s https://api.sanity.io/v2025-03-01/agent-context/<projectId>/<dataset>/partner-portal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect `initial_context`, `groq_query`, `schema_explorer`, `array_field_reader`. Then ask the chat UI "What content do you have access to?" — the answer should reflect the `groqFilter`, nothing more.

## Gotchas

- **MCP returns `-32004`** → the Studio is not deployed (schema deploy alone is not enough).
- **Tools list is empty / config not found** → the `sanity.agentContext` document is a draft; publish it.
- **Agent sees too much/too little** → the `groqFilter` is the only scoping; the viewer token itself reads the whole dataset. Test the filter in Vision before shipping.
- **Semantic search errors** → hybrid search needs Dataset Embeddings enabled (`sanity datasets embeddings enable`); `text::semanticSimilarity()` only works inside `score()`. Keep a keyword `match` fallback (see `app/sanity/search.ts`).
- **New document types** → add them to the relevant `groqFilter`s and mention them in `instructions`, or no surface will surface them.
