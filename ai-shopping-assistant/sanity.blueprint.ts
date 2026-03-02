import { defineBlueprint, defineDocumentFunction } from "@sanity/blueprints";

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: "agent-conversation",
      event: {
        // Only trigger when messages change (not other fields like classification),
        // or when a new conversation is created with messages already present.
        // This prevents infinite loops since the handler only writes classification fields.
        filter:
          '_type == "agent.conversation" && (delta::changedAny(messages) || (delta::operation() == "create") && defined(messages))',
        on: ["create", "update"],
      },
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      },
    }),
  ],
});
