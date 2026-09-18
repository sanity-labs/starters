# Knowledge Base

A Next.js help center and two chat agents that demonstrate [Sanity Context](https://www.sanity.io/docs/ai/sanity-context) retrieval modes: **GROQ** for structured lookup, and **Knowledge Bases** (beta) for grounded prose.

This is not a vector database. A Knowledge Base is a pre-built index. A build writes entries, files Issues where sources disagree, and serves an outline the agent holds in context.

```sh
pnpm create sanity@latest --template sanity-labs/starters/knowledge-base
```

> Knowledge Bases are an opt-in beta. An organization admin enables Context under **Manage → Apps**. Plan limits cap how many Knowledge Bases and sources you can hold. Those numbers are not published here; check your plan or talk to Sanity if you need higher limits. Features and limits may change before general availability.

## GROQ vs Knowledge Base

| When the question is…                           | Use                 | Why                                                                |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| "Which plan includes SMS under $200/mo?"        | GROQ mode           | Filterable fields on `product`. Exact at any scale. No build step. |
| "What is the refund window?"                    | GROQ mode           | The FAQ is a structured fact.                                      |
| "Is a paused campaign's audience still billed?" | Knowledge Base mode | The answer is spread across help articles and files.               |
| "What are the first 15 minutes of a SEV-1?"     | Knowledge Base mode | Runbooks live as uploaded files.                                   |

**Never attach a dataset source and a Knowledge Base source on the same MCP.** The dataset source wins and the Knowledge Base sources are ignored, with no error. Multiple sources belong on the **Knowledge Base** (dataset + files + website), not on the MCP.

`?mode=groq` or `?mode=knowledge_base` exists only as a per-connection override. Mode is derived from the MCP's sources.

## What's inside

| Workspace        | What it is                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| **`studio/`**    | Schema, Needs Review for policies, seed documents and uploadable files   |
| **`app/`**       | Help center, `/chat` (support), `/internal` (ops)                        |
| **`functions/`** | `set-review-date` stamps a 90-day review clock on policies that lack one |

Seed content is **Beacon**, a fictional customer-engagement SaaS. Typed documents live in `studio/scripts/generate-seed.ts`. File sources live in `studio/seed/files/`.

### Security

- The dataset is **private**. Help-center reads use a project Viewer token on the server.
- Chat uses an **organization** token with Context Viewer. A project token is refused (`403 contextGrantRequired`).
- Tokens and MCP URLs never reach the browser.
- `groqFilter` is the GROQ-mode boundary. Knowledge Base mode is scoped by which Knowledge Bases the MCP serves.

## Prerequisites

1. A Sanity project and organization. An org admin enables **Context** under Manage → Apps.
2. Sanity Studio **5.1.0+**. GROQ-mode MCPs need `sanity schema deploy`.
3. An [Anthropic API key](https://console.anthropic.com) for the chat harness. Identity-linked org keys also need `ANTHROPIC_WORKSPACE_ID` (`wrkspc_…` from Console → Settings → Workspaces).
4. Room on your plan for two Knowledge Bases and their sources.

## Code setup

```sh
pnpm install
# Copy app/.env.example to app/.env.local if bootstrap has not created it
pnpm bootstrap
pnpm dev
```

Studio: `http://localhost:3333`. Help center: `http://localhost:3000`.

Bootstrap deploys the schema, makes the dataset private, enables Dataset Embeddings, imports seed documents, mints a project Viewer token, and prompts for the org ID / Context Viewer token. It does **not** create Knowledge Bases or MCP endpoints. Those live in the Context app.

## Product setup: Knowledge Bases

In the [Context app](https://www.sanity.io/docs/ai/sanity-context-create-knowledge-base), create two Knowledge Bases. Vague purposes produce vague outlines.

### 1. Beacon Customer Support

**Purpose:** Customer-facing support Knowledge Base for Beacon. Covers onboarding, campaigns, deliverability, billing, and data export.

**Sources:**

1. **Dataset** (this project / dataset), query:

```groq
*[_type == "helpArticle" && status == "published"]{
  title,
  summary,
  "content": pt::text(content),
  audience,
  products,
  topics
}
```

2. **Files** — upload everything in `studio/seed/files/customer/`:
   - `beacon-billing-refund-policy.pdf` (says **45 days**; the article and FAQ say **30**)
   - `beacon-deliverability-guide.pdf`

### 2. Beacon Internal Ops

**Purpose:** Internal ops Knowledge Base for Beacon staff. Covers incident response, on-call, billing disputes, and customer data export.

**Sources:** upload `studio/seed/files/internal/` (Confluence markdown plus runbook PDFs). Markdown is accepted as a file source; the PDFs are the same copy for the upload-files demo.

### Build and resolve the refund Issue

Click **Build entries**. When status reads **Entries up to date**, open **Issues**.

The customer Knowledge Base should surface a conflict: the help article / FAQ say a **30-day** refund window; the finance PDF says **45 days**. Resolve it by keeping the **30-day** claim. That choice becomes an Instruction, anchored to its sources.

Coverage gaps are recorded but not always shown for review. You do not need an empty queue before serving the Knowledge Base.

To change what a Knowledge Base says later, change the source (edit the article in Studio) or add an Instruction. Entries are build-owned Markdown and are not hand-edited.

## Product setup: four MCP endpoints

Create these in the Context app. Names are immutable after save.

| Name                | Sources                                    | groqFilter                       | Instructions (summary)                                                                                                                                                 |
| ------------------- | ------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beacon-catalog`    | Dataset `PROJECT.DATASET`                  | `_type in ["product", "faq"]`    | Catalog and FAQ facts only. `priceMonthly` is USD. `seatLimit` 0 means unlimited. Hybrid: filter first, then `score(boost(..., 2), text::semanticSimilarity($query))`. |
| `beacon-support-kb` | Knowledge Base **Beacon Customer Support** | (none)                           | Customer-facing how-to. Refund window ground truth is 30 days if an Instruction exists.                                                                                |
| `beacon-ops`        | Dataset `PROJECT.DATASET`                  | `_type in ["policy", "product"]` | Staff policies and catalog quotes. Warn when `reviewByDate < now()`. Critical first.                                                                                   |
| `beacon-ops-kb`     | Knowledge Base **Beacon Internal Ops**     | (none)                           | Runbooks and Confluence exports. Do not invent approval thresholds.                                                                                                    |

Endpoint URL:

```
https://api.sanity.io/v1/context/organizations/<organizationId>/mcp/<name>
```

Paste into `app/.env.local`:

```
SANITY_MCP_SUPPORT_GROQ_URL=.../mcp/beacon-catalog
SANITY_MCP_SUPPORT_KB_URL=.../mcp/beacon-support-kb
SANITY_MCP_OPS_GROQ_URL=.../mcp/beacon-ops
SANITY_MCP_OPS_KB_URL=.../mcp/beacon-ops-kb
```

Auth header: `Authorization: Bearer <SANITY_ORGANIZATION_TOKEN>`.

### Verify

```sh
curl -X POST "$SANITY_MCP_SUPPORT_GROQ_URL" \
  -H "Authorization: Bearer $SANITY_ORGANIZATION_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

GROQ endpoints should list `initial_context`, `groq_query`, `schema_explorer`, `array_field_reader`. Knowledge Base endpoints should list `initial_context` and `knowledge_base_read`.

Then ask:

- Support GROQ: "Which plan includes SMS under $200/mo?"
- Support KB: "Is a paused campaign's audience still billed?"
- Ops GROQ: "Which critical policies are overdue for review?"
- Ops KB: "What are the first 15 minutes of a SEV-1?"

## Keep it current

- Refresh interval defaults to **weekly**. A refresh recrawls dataset and website sources and **files Issues**. It does not rewrite entries by itself.
- While Issues are open the Knowledge Base sits in **Review** and still serves the last build.
- Uploaded files never re-sync. Replace the upload to change them.
- Changing the purpose requires a **rebuild**. A bad build can be restored to an earlier version.
- There is no documented build-complete event for a Sanity Function to subscribe to. This starter does not add one.

Optional later: add the deployed help-center URL as a **website** source. localhost is not crawlable.

## Multiple sources: Knowledge Base vs MCP

**On a Knowledge Base:** combining a dataset, files, and a website is the point. The build reconciles them.

**On an MCP:** one source type. A dataset source forces GROQ mode and drops Knowledge Base sources. Use two MCPs on the same chat route, which is what `/chat` and `/internal` already do.

## Insights (not shipped)

Conversation Insights now lives in the [Context app](https://www.sanity.io/docs/ai/sanity-context-insights). This starter does not save transcripts or deploy a classifier. Wire that later if you want the loop.

## Project structure

```
knowledge-base/
├── studio/                # Studio, schema, bootstrap, seed
│   └── seed/files/        # PDFs + markdown to upload in the Context app
├── app/                   # Help center + two chat routes
├── functions/             # set-review-date
├── packages/@starter/     # eslint, tsconfig, generated types
├── skills/                # add-mcp-surface
├── sanity.blueprint.ts
└── package.json
```

## Scripts

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Studio, app, and functions       |
| `pnpm bootstrap` | Schema, embeddings, seed, tokens |
| `pnpm typegen`   | Regenerate TypeGen types         |
| `pnpm validate`  | Template compatibility           |

## Environment variables

Each workspace manages its own `.env`. Copy `app/.env.example` to `app/.env.local`. See that file for required values.
