# Knowledge Base

A Next.js help center and two chat agents that demonstrate [Sanity Context](https://www.sanity.io/docs/ai/sanity-context) retrieval modes: **GROQ** for structured lookup, and **Knowledge Bases** (beta) for grounded prose.

This is not a vector database. A Knowledge Base is a pre-built index. A build writes entries, files Issues where sources disagree, and serves an outline the agent holds in context. GROQ mode is the other half: it queries the dataset live, and with Dataset Embeddings enabled it can rank with `text::semanticSimilarity()`. The Knowledge Base reconciles ahead of time; GROQ ranks at query time; both are Context.

Everything you paste into the Context app (Knowledge Base purposes, source queries, MCP `groqFilter` and instructions) is checked in under [`context/`](./context/README.md).

```sh
pnpm create sanity@latest --template sanity-labs/starters/knowledge-base
```

> Knowledge Bases are an opt-in beta. An organization admin enables Context Knowledge Bases from the **Labs** page of your organization in Manage; GROQ-mode MCPs are not gated by that toggle. Plan limits cap how many Knowledge Bases and sources you can hold. Those numbers are not published here; check your plan or talk to Sanity if you need higher limits. Features and limits may change before general availability.

## GROQ vs Knowledge Base

| When the question is…                           | Use                 | Why                                                                |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| "Which plan includes SMS under $200/mo?"        | GROQ mode           | Filterable fields on `product`. Exact at any scale. No build step. |
| "What is the refund window?"                    | GROQ mode           | The FAQ is a structured fact.                                      |
| "Is a paused campaign's audience still billed?" | Knowledge Base mode | The answer is spread across help articles and files.               |
| "What are the first 15 minutes of a SEV-1?"     | Knowledge Base mode | Runbooks live as uploaded files.                                   |

**Never attach a dataset source and a Knowledge Base source on the same MCP.** The dataset source wins and the Knowledge Base sources are ignored, with no error. Multiple sources belong on the **Knowledge Base** (dataset + files + website), not on the MCP.

Mode is derived from the MCP's sources. The endpoint URL also accepts per-connection overrides, none of which this starter uses: `?mode=groq|knowledge_base`, `?tools=` (allowlist, e.g. `groq_query,schema_explorer`), `?groqFilter=` (narrows the configured filter with `&&`; never widens it), `?perspective=`, `?embeddings=true|false`, and `?knowledgeBases=`. See the [MCP reference](https://www.sanity.io/docs/ai/sanity-context-mcp).

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
- The organization token and MCP URLs never reach the browser. The project Viewer token is used by `next-sanity` Live in the browser only while draft mode is on (Presentation).
- `groqFilter` is the GROQ-mode boundary. Knowledge Base mode is scoped by which Knowledge Bases the MCP serves.
- `/chat` and `/internal` are both unauthenticated demo agents. Ops is a second Beacon story (fake runbooks and policies), not a staff trust boundary. Either route spends your Anthropic quota. If you later point the ops MCPs at real internal sources, add auth before you deploy.

## Prerequisites

1. A Sanity project and organization. An org admin enables **Context Knowledge Bases** from the Labs page of your organization in Manage.
2. Sanity Studio **5.1.0+**. GROQ-mode MCPs need `sanity schema deploy`.
3. An [Anthropic API key](https://console.anthropic.com) for the chat harness. Identity-linked org keys also need `ANTHROPIC_WORKSPACE_ID` (`wrkspc_…` from Console → Settings → Workspaces).
4. Room on your plan for two Knowledge Bases and their sources.

## Code setup

```sh
pnpm install
pnpm bootstrap   # creates app/.env.local; paste the MCP URLs into it later
pnpm dev
```

Studio: `http://localhost:3333`. Help center: `http://localhost:3000`.

Bootstrap prompts for an Anthropic API key and a Context Viewer organization token, adds a CORS origin for `localhost:3000`, deploys the blueprint and the schema, makes the dataset private, enables Dataset Embeddings, mints a project Viewer token, regenerates and imports seed documents (policy review dates are relative to today), and runs typegen. It does **not** create Knowledge Bases or MCP endpoints. Those live in the Context app.

You do not need all four MCPs before trying chat. Each route runs with whichever of its two URLs is set: create `beacon-catalog` first and `/chat` answers catalog questions in GROQ mode while the Knowledge Base builds.

## Product setup: Knowledge Bases

In the [Context app](https://www.sanity.io/docs/ai/sanity-context-create-knowledge-base), create two Knowledge Bases. The exact purpose text, source query, and file list for each is in `context/knowledge-bases/`. Vague purposes produce vague outlines.

### 1. Beacon Customer Support

Full config: [`context/knowledge-bases/beacon-customer-support.md`](./context/knowledge-bases/beacon-customer-support.md).

**Sources:**

1. **Dataset** (this project / dataset). A full GROQ query is required; references are dereferenced so the build sees titles, not `_ref` ids:

```groq
*[_type == "helpArticle" && status == "published"]{
  title,
  summary,
  "content": pt::text(content),
  audience,
  "products": products[]->title,
  "topics": topics[]->title
}
```

2. **Files** — upload all 10 PDFs in `studio/seed/files/customer/`. Two are stale on purpose:
   - `beacon-billing-refund-policy.pdf` says **45 days** from the charge date; the help article, FAQ, and refund policy say **30 days** from the invoice date. That is the Issue the first build should surface, because both sides are sources of this Knowledge Base.
   - `beacon-sms-sender-registration-primer.pdf` is stale on which plans include SMS. It disagrees with the product catalog and the internal sales notes, neither of which is a source here, so do not expect an Issue for it; it is a GROQ-vs-KB routing demo instead.

### 2. Beacon Internal Ops

Full config: [`context/knowledge-bases/beacon-internal-ops.md`](./context/knowledge-bases/beacon-internal-ops.md).

**Sources:** upload all 12 PDFs in `studio/seed/files/internal/` (Confluence exports, runbooks, two sales notes). No dataset source; structured `policy` records are served live through the `beacon-ops` GROQ MCP.

### Editing the seed files

The `.md` next to each PDF is the editable source. Markdown is also accepted as a file source, so you can upload those instead. After editing, re-render the PDFs with `pnpm --filter studio seed:files` (needs Playwright once; see the header of `studio/scripts/generate-pdfs.ts`). PDFs are committed so bootstrap never needs a browser.

### Build and resolve the refund Issue

Click **Build entries**. When status reads **Entries up to date**, open **Issues**.

The customer Knowledge Base should surface a conflict: the help article / FAQ say a **30-day** refund window; the finance PDF says **45 days**. Resolve it by keeping the **30-day** claim. That choice becomes an Instruction, anchored to its sources.

Issues surface conflicts the build detects, so this is not guaranteed. If no Issue appears, add the Instruction yourself; the text is in the Knowledge Base config file.

Coverage gaps are recorded but not surfaced for review. You do not need an empty queue before serving the Knowledge Base.

To change what a Knowledge Base says later, change the source (edit the article in Studio) or add an Instruction. Entries are build-owned Markdown and are not hand-edited.

## Product setup: four MCP endpoints

Create these in the Context app. Names are immutable after save. The full instructions text for each is in `context/mcp/<name>.md`; paste it into the MCP's **Instructions** field.

| Name                | Sources                                    | groqFilter                                                          | Instructions (summary)                                                                                                         |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `beacon-catalog`    | Dataset `PROJECT.DATASET`                  | `_type == "product" \|\| (_type == "faq" && status == "published")` | Catalog and FAQ facts only. `priceMonthly` is USD. `seatLimit` 0 means unlimited. Filter first, then hybrid rank in `score()`. |
| `beacon-support-kb` | Knowledge Base **Beacon Customer Support** | (none)                                                              | Customer-facing how-to. Refund window is 30 days.                                                                              |
| `beacon-ops`        | Dataset `PROJECT.DATASET`                  | `_type in ["policy", "product"]`                                    | Staff policies and catalog quotes. Warn when `reviewByDate < now()`. Critical first.                                           |
| `beacon-ops-kb`     | Knowledge Base **Beacon Internal Ops**     | (none)                                                              | Runbooks and Confluence exports. Do not invent approval thresholds.                                                            |

`beacon-catalog` is the customer surface, so its filter only passes published FAQs (`product` has no `status` field). `groqFilter` is a filter expression only: no `*[`, projection, or ordering.

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

The app fetches each endpoint's `/initial-context` over HTTP once per five minutes and inlines it in the system prompt (the GROQ schema summary, or the Knowledge Base outline), then drops the `initial_context` tool. If that fetch fails, the chat route returns a `502` with the HTTP status and the server's message rather than answering from nothing; a wrong token type shows up as `403 contextGrantRequired`.

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

## Deploying

`.github/workflows/deploy.yml` runs when this starter is its own repository (cloned via `sanity init --template`). It deploys the Studio and the blueprint (the `set-review-date` Function) on push to `main`, and builds the app as a guard. It needs a GitHub Environment named `knowledge-base` with vars `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_STACK_ID` and secrets `SANITY_AUTH_TOKEN` and `SANITY_API_READ_TOKEN` (the dataset is private, so the app build needs the Viewer token to prerender articles).

Deploy the Next.js app to Vercel by importing the repo with `app/` as the root directory and setting the variables from `app/.env.example`. The generated `packages/@starter/sanity-types/sanity.types.ts` is committed so that build resolves it without running typegen.

## Project structure

```
knowledge-base/
├── context/               # Copy-paste config for the Context app
│   ├── knowledge-bases/   # Purpose, source query, file list per Knowledge Base
│   └── mcp/               # Name, sources, groqFilter, instructions per MCP
├── studio/                # Studio, schema, bootstrap, seed
│   └── seed/files/        # PDFs to upload in the Context app (+ .md sources)
├── app/                   # Help center + two chat routes
├── functions/             # set-review-date
├── packages/@starter/     # eslint, tsconfig, generated types
├── skills/                # add-mcp-surface
├── sanity.blueprint.ts
└── package.json
```

## Scripts

| Command                              | Description                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `pnpm dev`                           | Studio, app, and functions                           |
| `pnpm bootstrap`                     | Schema, embeddings, seed, tokens                     |
| `pnpm typegen`                       | Regenerate TypeGen types                             |
| `pnpm validate`                      | Template compatibility                               |
| `pnpm --filter studio seed:generate` | Rebuild `seed/data.ndjson` (dates relative to today) |
| `pnpm --filter studio seed:files`    | Re-render seed PDFs from their `.md` sources         |

## Environment variables

Each workspace manages its own `.env`. Copy `app/.env.example` to `app/.env.local`. See that file for required values.
