import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@sanity/client";
import { documentEventHandler } from "@sanity/functions";
import { generateText, Output } from "ai";
import { z } from "zod";

// Claude model used for conversation classification (https://docs.anthropic.com/en/docs/about-claude/models)
const MODEL_ID = "claude-haiku-4-5-20251001";

const classificationSchema = z.object({
  summary: z
    .string()
    .describe(
      "A brief factual summary of what the user asked for. Just state the request, no judgment or commentary.",
    ),
  successRate: z
    .number()
    .describe(
      "0-100 score: Did the conversation achieve its goal? 100 = user got exactly what they needed, 50 = partially helped, 0 = complete failure.",
    ),
  agentConfusion: z
    .number()
    .describe(
      "0-100 score: How much did the agent struggle to respond helpfully? 0 = responded confidently (even if redirecting off-topic questions), 100 = completely lost or gave wrong info. Note: gracefully handling off-topic questions is NOT confusion.",
    ),
  userConfusion: z
    .number()
    .describe(
      "0-100 score: How unclear was the user request? 0 = crystal clear, 100 = completely incomprehensible",
    ),
  contentGap: z
    .string()
    .describe("Content that the agent could not find")
    .optional(),
});

type ConversationClassification = z.infer<typeof classificationSchema>;

interface ConversationMessage {
  role: string;
  content: string;
}

// Classifies conversation messages using AI.
async function classifyMessages(
  messages: ConversationMessage[],
): Promise<ConversationClassification | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set, skipping classification");
    return null;
  }

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { output } = await generateText({
      model: anthropic(MODEL_ID),
      output: Output.object({
        schema: classificationSchema,
      }),
      prompt: `
Analyze this shopping assistant conversation and classify it.

Score these on a 0-100 scale:
- successRate: Did the conversation achieve its goal? (100 = user got exactly what they needed, 50 = partially helped, 0 = complete failure)
- agentConfusion: How much did the agent struggle? (0 = handled confidently, 100 = completely lost). Gracefully redirecting off-topic questions = 0.
- userConfusion: How unclear or off-topic was the user? (0 = clear relevant request, 100 = incomprehensible or completely off-topic)

Also determine:
- summary: What did the user ask for? Just state it factually.
- contentGap: ONLY fill this if the agent struggled because the STORE IS MISSING content (products, categories, info). Leave empty otherwise.

<conversation>
${JSON.stringify(messages, null, 2)}
</conversation>`,
    });

    return output ?? null;
  } catch (error) {
    console.error("Classification failed:", error);
    return null;
  }
}

// Triggered by Sanity Functions (via sanity.blueprint.ts) when an agent.conversation
// document is created or its messages field changes. Only writes to classification/
// contentGap fields (never messages), so it won't re-trigger itself.
export const handler = documentEventHandler(async ({ context, event }) => {
  const client = createClient({
    ...context.clientOptions,
    apiVersion: "vX",
  });
  const classification = await classifyMessages(event.data.messages);
  if (!classification) {
    console.error("Classification failed");
    return;
  }
  await client
    .patch(event.data._id)
    .setIfMissing({ classification: {} })
    .set({
      classification: {
        successRate: classification.successRate,
        agentConfusion: classification.agentConfusion,
        userConfusion: classification.userConfusion,
      },
    })
    .set({ summary: classification.summary })
    .set({ contentGap: classification.contentGap || undefined })
    .commit();
  console.log("Classification complete:", classification);
});
