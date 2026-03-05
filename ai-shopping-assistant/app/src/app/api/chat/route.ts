import { anthropic } from "@ai-sdk/anthropic";
import { createMCPClient } from "@ai-sdk/mcp";
import { convertToModelMessages, stepCountIs, streamText, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";

import { CLIENT_TOOLS, productFiltersSchema, type UserContext } from "@/lib/client-tools";
import { saveConversation } from "@/lib/save-conversation";
import { client } from "@/sanity/lib/client";

// Slugs for Sanity Agent Context and Agent Config — override via env vars if needed
const contextSlug = process.env.SANITY_CONTEXT_SLUG || "default";
const agentConfigSlug = process.env.SANITY_AGENT_CONFIG_SLUG || "default";
// Claude model used for chat responses (https://docs.anthropic.com/en/docs/about-claude/models)
const MODEL_ID = "claude-opus-4-5";
// Maximum number of agentic steps (tool call rounds) before stopping
const MAX_STEPS = 20;

// Client-side tool stubs — no execute functions because execution happens
// on the client via onToolCall in Chat.tsx

const clientTools: ToolSet = {
  [CLIENT_TOOLS.PAGE_CONTEXT]: {
    description: `Page context as markdown: URL, title, and text content (headings, links, lists). Fast. No visuals.`,
    inputSchema: z.object({
      reason: z.string().describe("Why you need page context"),
    }),
  },
  [CLIENT_TOOLS.SCREENSHOT]: {
    description: `Visual screenshot of the page. You CANNOT see anything visual without this - no images, colors, layout, or appearance.`,
    inputSchema: z.object({
      reason: z.string().describe("Why you need a screenshot"),
    }),
  },
  [CLIENT_TOOLS.SET_FILTERS]: {
    description: `Update the product listing page filters. Only use AFTER you've used groq_query to: 1) get valid filter values (slugs/codes), and 2) confirm matching products exist. Use the exact values from your query. Do not use this tool blindly - you should already know what results the user will see.`,
    inputSchema: productFiltersSchema,
  },
};

interface BuildSystemPromptParams {
  basePrompt: string;
  userContext: UserContext;
}

/* System prompt is split: the base prompt (persona, tone, boundaries) lives in Sanity
   so content editors can customize it without touching code. Implementation-specific
   directives (page context format, document directive syntax) are appended here. */
function buildSystemPrompt({ basePrompt, userContext }: BuildSystemPromptParams): string {
  return `
${basePrompt}

# Page context

The user's current page is provided below. Use this for questions like "Where am I?", "What page is this?", or "Give me a link."

<user-context>
  <document-title>${userContext.documentTitle}</document-title>
  <document-location>${userContext.documentLocation}</document-location>
</user-context>

For deeper page understanding, two tools are available:

- **get_page_context**: Returns the page as markdown (headings, links, lists). Use for "What's on this page?", "What products are shown?", "Summarize this page."
- **get_page_screenshot**: Returns a visual screenshot. Use only when you need to see images, colors, or layout—for questions like "What color is this?", "Does this look right?", "Show me what you see."

Choose the minimum level needed: user-context first, then get_page_context, then get_page_screenshot.

# Displaying products

Render products using document directives so the UI can display rich cards. Query Sanity to get the document _id and _type, then use this syntax:

Block format (for product lists):
::document{id="<_id>" type="<_type>"}

Inline format (within a sentence):
:document{id="<_id>" type="<_type>"}

Example response showing three jackets:
::document{id="product-abc123" type="product"}
::document{id="product-def456" type="product"}
::document{id="product-ghi789" type="product"}

Write product names only inside directives. If page context mentions product names, summarize generically ("the products shown") or query Sanity for their IDs rather than repeating names as plain text.
`;
}

export async function POST(req: Request) {
  const {
    messages,
    userContext,
    id: chatId,
  }: { messages: UIMessage[]; userContext: UserContext; id: string } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const apiVersion = new Date().toISOString().slice(0, 10);
  const mcpUrl = `https://api.sanity.io/v${apiVersion}/agent-context/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${contextSlug}`;

  const [mcpClient, agentConfig] = await Promise.all([
    createMCPClient({
      transport: {
        type: "http",
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${process.env.SANITY_API_READ_TOKEN}`,
        },
      },
    }),
    client.fetch<{ systemPrompt: string | null } | null>(
      `*[_type == "agent.config" && slug.current == $slug][0] { systemPrompt }`,
      { slug: agentConfigSlug },
    ),
  ]);

  if (!agentConfig?.systemPrompt) {
    throw new Error(
      "Agent config not found or missing system prompt. Create one in Sanity Studio.",
    );
  }

  const systemPrompt = buildSystemPrompt({
    basePrompt: agentConfig.systemPrompt,
    userContext,
  });

  try {
    const mcpTools = await mcpClient.tools();

    const result = streamText({
      model: anthropic(MODEL_ID),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: {
        ...mcpTools,
        ...clientTools,
      },
      stopWhen: stepCountIs(MAX_STEPS),
      onFinish: async () => {
        await mcpClient.close();
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: allMessages }) => {
        await saveConversation({
          chatId,
          messages: allMessages,
        });
      },
    });
  } catch (error) {
    await mcpClient.close();
    throw error;
  }
}
