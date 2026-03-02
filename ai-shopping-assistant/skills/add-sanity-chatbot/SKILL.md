---
name: add-sanity-chatbot
description: Add an AI chatbot that operates on your Content Lake to an existing Next.js + Sanity project. Use when adding a chat assistant to a site that already has the Studio and a Next.js frontend. Covers dependency installation, API route setup, chat UI components, Studio plugin configuration, and system prompt design.
---

# Add an AI Chatbot That Operates on Your Content

Add an AI chatbot to your existing Next.js + Sanity project. The chatbot connects to the Content Lake via Context MCP, giving the LLM structured, schema-aware access to your content. It can answer questions, run GROQ queries, and reason over your data, not just match keywords.

**What this gives you:**

- A chat widget in your Next.js app connected to an LLM
- Schema-aware content access: the agent understands your content model, not just text similarity
- Semantic search layered on top of structural GROQ queries against the Content Lake
- Client-side tools for page context and screenshots

## Prerequisites

Before starting, confirm:

1. **Existing Next.js app** (App Router) with a working frontend
2. **Existing Studio** (v5.1.0+), either embedded or separate
3. **Sanity project credentials** available

Gather these credentials:

| Credential                | Where to get it                                                                |
| ------------------------- | ------------------------------------------------------------------------------ |
| **Sanity Project ID**     | Your `sanity.config.ts` or [sanity.io/manage](https://sanity.io/manage)       |
| **Dataset name**          | Usually `production`. Check your `sanity.config.ts`                            |
| **Sanity API read token** | [sanity.io/manage](https://sanity.io/manage) -> Project -> API -> Tokens      |
| **Anthropic API key**     | From [console.anthropic.com](https://console.anthropic.com) (or other provider) |

## Workflow

### Step 1: Set Up Agent Context in Studio

Install the plugin and create an agent context document to scope what content the chatbot can access.

See [references/studio-setup.md](references/studio-setup.md)

### Step 2: Install Dependencies in Your Next.js App

**IMPORTANT: Do NOT guess package versions.** AI SDK packages update frequently. Always check the versions below or run `npm info <package> version`.

```bash
npm install @ai-sdk/anthropic@^3.0.23 @ai-sdk/mcp@^1.0.13 @ai-sdk/react@^3.0.52 ai@^6.0.50 zod@^4.3.6
```

Optional dependencies for advanced features (page context capture, screenshots):

```bash
npm install turndown html2canvas-pro lucide-react
npm install -D @types/turndown
```

**Version reference** (from the working ecommerce example):

| Package            | Version   | Notes                                    |
| ------------------ | --------- | ---------------------------------------- |
| `@ai-sdk/anthropic`| ^3.0.23  | Anthropic provider for Vercel AI SDK     |
| `@ai-sdk/mcp`     | ^1.0.13   | MCP client for tool discovery            |
| `@ai-sdk/react`   | ^3.0.52   | React hooks (`useChat`)                  |
| `ai`               | ^6.0.50  | Core Vercel AI SDK                       |
| `zod`              | ^4.3.6   | Schema validation for tool inputs        |
| `turndown`         | ^7.2.2   | HTML-to-markdown for page context        |
| `html2canvas-pro`  | ^1.6.6   | Screenshot capture                       |
| `lucide-react`     | ^0.563.0 | Icons for chat UI                        |

### Step 3: Set Up Environment Variables

Add to your `.env.local`:

```bash
# Sanity Configuration (you may already have these)
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production

# Sanity API token with read access
SANITY_API_READ_TOKEN=your-read-token

# Context MCP URL (from your Agent Context document in Studio)
SANITY_CONTEXT_MCP_URL=https://api.sanity.io/vX/agent-context/your-project-id/production/your-slug

# LLM API key
ANTHROPIC_API_KEY=your-anthropic-key
```

Replace `vX` with your API version (e.g., `v2025-01-01`) and `your-slug` with the slug from your Agent Context document.

### Step 4: Create the Chat Implementation

Create the API route and chat UI components.

See [references/chat-implementation.md](references/chat-implementation.md)

### Step 5: Test the Integration

1. Start your dev server: `npm run dev`
2. Open your app and interact with the chat widget
3. The agent should call `initial_context` first to understand your content types
4. Try asking: "What content do you have access to?"

You can also test the API route directly:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What content do you have access to?"}]}'
```

### Step 6: Customize the System Prompt

The system prompt shapes how your chatbot behaves. Define it inline in the API route or store it in a Sanity document for easy editing.

**Basic inline prompt:**

```ts
const SYSTEM_PROMPT = `
You are a helpful assistant for this website.

## Your Capabilities
- Search and retrieve content using the available tools
- Answer questions about the site's content
- Help users find what they're looking for

## How to Respond
- Be concise and helpful
- When referencing content, include relevant details
- If you can't find what the user wants, suggest alternatives

## Tool Usage
- Use initial_context first to understand available content types
- Use groq_query to find specific content
- Use schema_explorer when you need field details
`
```

For more prompt examples (e-commerce, docs, support), see the system prompts guide in the reference skill.

### Step 7: Explore and Optimize (Recommended)

Once the chatbot works, explore your dataset and build a production-quality system prompt:

```bash
npx skills add https://github.com/sanity-io/agent-context --skill optimize-agent-prompt
```

## Important Notes

### AI SDK v6: `convertToModelMessages()`

The Vercel AI SDK v6 requires converting UI messages to model messages before passing to `streamText`:

```ts
import {convertToModelMessages} from 'ai'

// In your API route:
messages: await convertToModelMessages(messages),
```

Do not pass raw `UIMessage[]` directly to `streamText`. This will cause type errors or silent failures.

### Next 16 + Turbopack: `next/dynamic` Issues

If you are using Next.js 16 with Turbopack (the default dev bundler), you may encounter issues with `next/dynamic` for client components. If the chat component fails to render:

1. Try importing it directly instead of using `next/dynamic`
2. Or disable Turbopack: `next dev --no-turbopack`
3. Check the Next.js GitHub issues for the latest status

### MCP URL Format

The Context MCP URL has two forms:

- **Base URL** (all content): `https://api.sanity.io/:apiVersion/agent-context/:projectId/:dataset`
- **Scoped URL** (filtered content): `https://api.sanity.io/:apiVersion/agent-context/:projectId/:dataset/:slug`

Use the scoped URL for production. It limits what content the agent can access based on the GROQ filter in your Agent Context document.

### Available MCP Tools

| Tool              | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `initial_context` | Get compressed schema overview (types, fields, document counts) |
| `groq_query`      | Execute GROQ queries with optional semantic search              |
| `schema_explorer` | Get detailed schema for a specific document type                |

## Troubleshooting

### "SANITY_CONTEXT_MCP_URL is not set"

1. Create an Agent Context document in Studio
2. Give it a slug
3. Copy the MCP URL shown at the top of the document
4. Add it to `.env.local`

### "401 Unauthorized" from MCP

Your `SANITY_API_READ_TOKEN` is missing or invalid. Generate a new token at [sanity.io/manage](https://sanity.io/manage) -> Project -> API -> Tokens with Viewer permissions.

### "No documents found" / Empty results

Check your Agent Context document's content filter:

- Is the GROQ filter correct?
- Are the document types spelled correctly?
- Are there **published** documents matching the filter?

### Tools not appearing in LLM responses

1. Log `mcpClient.tools()` to verify tools are returned
2. Check the MCP URL (project ID, dataset, slug)
3. Verify the Agent Context document is **published**

### Context MCP returns errors or no schema

Context MCP needs your schema deployed server-side. This happens automatically when Studio runs, but if it's not working:

1. Ensure Studio is v5.1.0+
2. Open your Studio in a browser (triggers schema deployment)
3. Or manually deploy: `npx sanity schema deploy`

### Chat component not rendering

- Verify the component is marked `'use client'`
- Check browser console for hydration errors
- If using `next/dynamic`, try direct import instead (see Turbopack note above)
