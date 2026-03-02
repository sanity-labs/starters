# Content-Powered AI Shopping Assistant

Ecommerce starter with a Claude chatbot that uses Context MCP for structured access to the Content Lake.

## When to Load Files

| Task                        | Load These Files                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MCP connection setup        | `app/src/app/api/chat/route.ts` (lines 97-111)                                                                  |
| System prompt from Sanity   | `app/src/app/api/chat/route.ts` (lines 43-80, 107-120), `studio/schemaTypes/documents/agentConfig.ts`           |
| Client-side tool handling   | `app/src/components/chat/Chat.tsx` (lines 93-161), `app/src/lib/client-tools.ts`                                |
| Page context capture        | `app/src/lib/capture-context.ts`                                                                                 |
| Custom markdown rendering   | `app/src/components/chat/message/remarkDirectives.ts`, `app/src/components/chat/message/Product.tsx`             |
| Studio plugin setup         | `studio/sanity.config.ts`                                                                                        |
| Schema design patterns      | `studio/schemaTypes/documents/product.ts`, `studio/schemaTypes/index.ts`                                         |
| Sanity client/queries       | `app/src/sanity/lib/client.ts`, `app/src/sanity/queries/`                                                        |
| Conversation classification | `sanity.blueprint.ts`, `functions/agent-conversation/index.ts`, `app/src/lib/save-conversation.ts` |
| Agent Insights tool         | `studio/agent-insights-tool/agentInsightsPlugin.ts`, `studio/agent-insights-tool/OverviewView.tsx`, `studio/agent-insights-tool/ConversationsView.tsx` |
| Environment variables       | `app/.env.example`                                                                                               |

## File Map

### Agent Integration (Core)

```
app/src/app/api/chat/route.ts     # API route: MCP client, tools, streaming
app/src/lib/client-tools.ts       # Tool constants shared server/client
app/src/lib/capture-context.ts    # Page context & screenshot capture
app/src/lib/save-conversation.ts  # Save conversations for classification
```

### Chat UI

```
app/src/components/chat/
├── Chat.tsx                      # Main component: useChat, tool handling
├── ChatInput.tsx                 # Input field
├── ChatButton.tsx                # Floating button to open chat
├── Loader.tsx                    # Loading indicator
├── ToolCall.tsx                  # Debug tool call display
└── message/
    ├── Message.tsx               # Message rendering
    ├── TextPart.tsx              # Text with markdown
    ├── Document.tsx              # Routes directives to type-specific components
    ├── Product.tsx               # Product card directive
    └── remarkDirectives.ts       # Markdown directive parser
```

### Sanity Studio

```
studio/
├── sanity.config.ts              # Plugin setup, structure customization
├── schemaTypes/
│   ├── index.ts                  # Schema registration
│   ├── documents/
│   │   ├── product.ts            # Product schema
│   │   ├── category.ts           # Category schema
│   │   ├── brand.ts              # Brand schema
│   │   ├── color.ts              # Color schema
│   │   ├── material.ts           # Material schema
│   │   ├── size.ts               # Size schema
│   │   ├── agentConfig.ts        # Agent configuration (system prompt)
│   │   └── agentConversation.ts  # Conversation storage
│   └── objects/
│       ├── productVariant.ts     # Variant (size/color combos)
│       ├── price.ts              # Price object
│       └── seo.ts                # SEO metadata
└── agent-insights-tool/
    ├── agentInsightsPlugin.ts    # Plugin definition
    ├── AgentInsightsTool.tsx      # Main tool component
    ├── ConversationsView.tsx      # Conversation list view
    ├── OverviewView.tsx           # Overview dashboard
    └── ViewLayout.tsx             # Shared layout
```

### Blueprints & Functions (root level)

```
sanity.blueprint.ts               # Function triggers (delta filters)
functions/
└── agent-conversation/
    └── index.ts                  # Classification function
```

### Sanity Queries & Client

```
app/src/sanity/
├── lib/
│   ├── client.ts                 # Sanity client setup
│   └── image.ts                  # Image URL builder
└── queries/
    ├── index.ts                  # Query exports
    ├── products.ts               # Product queries
    ├── categories.ts             # Category queries
    ├── filters.ts                # Filter queries
    └── fragments.ts              # Reusable GROQ fragments
```

### Product Pages

```
app/src/app/
├── layout.tsx                    # Root layout with chat button
├── page.tsx                      # Homepage
└── products/
    ├── page.tsx                  # Product listing with filters
    └── [slug]/page.tsx           # Product detail page
```

### Skills

```
skills/add-sanity-chatbot/
├── SKILL.md                      # Skill definition and workflow
└── references/
    ├── chat-implementation.md    # Chat UI and API route reference
    └── studio-setup.md           # Studio plugin setup reference
```

## Key Patterns

### MCP Connection

The API route creates an MCP client connected to the Content Lake via Context MCP, which provides `groq_query`, `schema_explorer`, and `initial_context` tools scoped to the content defined in the Agent Context document.

See `app/src/app/api/chat/route.ts` lines 97-111

### Client Tools (No Server Execute)

Three client-side tools are defined without execute functions. The server declares them so Claude knows they exist, but execution happens on the client via `onToolCall` in `Chat.tsx`. This allows the agent to request page context, screenshots, and filter changes.

See `app/src/app/api/chat/route.ts` lines 14-31, `app/src/components/chat/Chat.tsx` lines 93-161

### System Prompt from Sanity

The base system prompt is stored in a Sanity document (`agent.config`) and fetched at request time. The API route appends implementation-specific sections (page context instructions, product directive syntax).

See `app/src/app/api/chat/route.ts` lines 43-80 (`buildSystemPrompt`), lines 107-120 (fetch & apply)

### Tool Handling on Client

The `Chat.tsx` component uses `onToolCall` to handle client-side tools: `get_page_context` captures the page as markdown, `get_page_screenshot` captures a visual screenshot, and `set_product_filters` navigates to filtered product URLs.

See `app/src/components/chat/Chat.tsx` lines 93-161

### Auto-continuation

The chat auto-continues when the last assistant message has tool calls (so Claude can process tool results without user intervention), but pauses when a screenshot is pending to allow the image to be sent separately.

See `app/src/components/chat/Chat.tsx` lines 89-92

### Custom Directives

Product cards are rendered using remark directives (`:document{id="..." type="..."}`). The `remarkDirectives` plugin transforms these into React components, and `Document.tsx` routes to type-specific renderers like `Product.tsx`.

See `app/src/components/chat/message/remarkDirectives.ts`, `app/src/components/chat/message/Document.tsx`

### Conversation Classification (Blueprint + Function)

Conversations are saved to Sanity after each chat. A Sanity Function triggered by `sanity.blueprint.ts` auto-classifies conversations using Claude Haiku, scoring success rate, agent confusion, and user confusion. The delta filter prevents infinite loops (only triggers on message changes, not classification updates).

See `sanity.blueprint.ts`, `functions/agent-conversation/index.ts`, `app/src/lib/save-conversation.ts`

### Agent Insights Tool

A custom Studio tool registered as a plugin (`agentInsightsPlugin`) in `studio/sanity.config.ts`. It provides two views for monitoring chatbot performance:

- **OverviewView** — Queries aggregate stats (total conversations, average success rate, average agent/user confusion, content gap rate) using `math::avg` in GROQ
- **ConversationsView** — Lists all `agent.conversation` documents in a table with color-coded classification badges (green/caution/critical) and two actions per row: inspect (dialog with full markdown transcript) and link (navigates to the document)

The tool uses `useClient` from `sanity` to query directly and `useRouter`/`useRouterState` from `sanity/router` for tab navigation between views.

See `studio/agent-insights-tool/agentInsightsPlugin.ts`, `studio/agent-insights-tool/OverviewView.tsx`, `studio/agent-insights-tool/ConversationsView.tsx`
