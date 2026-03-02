# Project Guidelines

## Overview

Ecommerce starter kit with an AI shopping assistant. A Next.js 16 storefront with a Claude chatbot that uses Context MCP for structured access to the Content Lake. The chatbot can search products, answer questions, apply filters, and display rich product cards.

Two main directories: `app/` (Next.js frontend) and `studio/` (Sanity Studio). They run as separate dev servers.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Content Operating System**: Sanity (Studio v5 with `@sanity/agent-context` plugin)
- **AI**: Anthropic Claude (via `@ai-sdk/anthropic`), Vercel AI SDK v6, MCP client (`@ai-sdk/mcp`)
- **Styling**: Tailwind CSS 4 (app), styled-components (studio)
- **Language**: TypeScript (strict)
- **Schema validation**: Zod v4

## Development Commands

### Root (runs both app and studio)

- `pnpm install` - Install all dependencies
- `pnpm dev` - Start both dev servers in parallel (app on http://localhost:3000, studio on http://localhost:3333)
- `pnpm dev:app` - Start only the Next.js app
- `pnpm dev:studio` - Start only the Studio
- `pnpm build` - Production build (app)
- `pnpm lint` - Run ESLint (app)
- `pnpm import-sample-data` - Import sample dataset

### Studio-specific

- `npx sanity schema deploy` - Deploy schema to Sanity cloud
- `npx sanity deploy` - Deploy Studio to Sanity hosting (run from `studio/`)

### Blueprints & Functions (run from root)

- `pnpm dev:functions` - Run Sanity Functions locally
- `pnpm dev:functions:logs` - View function logs
- `pnpm init:blueprints` - Initialize blueprint config
- `pnpm deploy:blueprints` - Deploy function triggers

## Code Style & Conventions

- TypeScript strict mode in both app and studio
- **App**: Semicolons, double quotes (ESLint + Next.js defaults)
- **Studio**: No semicolons, single quotes, no bracket spacing (Prettier config in package.json)
- Tailwind CSS for styling in the app; styled-components in the studio
- Zod schemas as single source of truth for tool input validation
- Client tools defined once in `app/src/lib/client-tools.ts`, shared between server API route and client components

## Project Structure

- `app/` - Next.js 16 frontend with AI shopping assistant
  - `app/src/app/api/chat/route.ts` - Chat API route (MCP connection, Claude, streaming)
  - `app/src/app/products/` - Product listing and detail pages
  - `app/src/components/chat/` - Chat widget components
  - `app/src/lib/` - Client tools, page context capture, conversation saving
  - `app/src/sanity/` - Sanity client, image helpers, GROQ queries
- `studio/` - Sanity Studio v5
  - `studio/schemaTypes/` - Document and object schemas (product, category, brand, etc.)
  - `studio/agent-insights-tool/` - Custom Studio tool for viewing chat analytics
- `functions/agent-conversation/` - Sanity Function for auto-classifying conversations
- `sanity.blueprint.ts` - Function triggers (delta filters)
- `skills/add-sanity-chatbot/` - Claude Code skill for adding chatbot to existing projects
- `studio/seed/` - Sample dataset for import
