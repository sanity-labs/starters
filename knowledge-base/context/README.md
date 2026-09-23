# Context app configuration

Everything you paste into the [Context app](https://www.sanity.io/docs/ai/sanity-context) lives here as plain files, so it is reviewable, diffable, and copy-paste exact. The Context app is still the source of record; these files are the checked-in draft of what it should hold.

| File                                                                                       | Create in the Context app as |
| ------------------------------------------------------------------------------------------ | ---------------------------- |
| [`knowledge-bases/beacon-customer-support.md`](knowledge-bases/beacon-customer-support.md) | Knowledge Base               |
| [`knowledge-bases/beacon-internal-ops.md`](knowledge-bases/beacon-internal-ops.md)         | Knowledge Base               |
| [`mcp/beacon-catalog.md`](mcp/beacon-catalog.md)                                           | MCP endpoint (GROQ mode)     |
| [`mcp/beacon-support-kb.md`](mcp/beacon-support-kb.md)                                     | MCP endpoint (KB mode)       |
| [`mcp/beacon-ops.md`](mcp/beacon-ops.md)                                                   | MCP endpoint (GROQ mode)     |
| [`mcp/beacon-ops-kb.md`](mcp/beacon-ops-kb.md)                                             | MCP endpoint (KB mode)       |

Order: Knowledge Bases first (build them and resolve Issues), then the four MCPs, then paste the endpoint URLs into `app/.env.local`.

Rules these files follow, from the docs:

- A Knowledge Base **dataset source** takes a full GROQ query (`*[...]{...}`), reads published documents only, and one Knowledge Base binds to one dataset.
- An MCP `groqFilter` is a **filter expression** only — the part inside `[ ... ]`. No projection, ordering, or `*[`.
- An MCP serves **one source type**. Dataset + Knowledge Base on the same MCP silently drops the Knowledge Base.
- MCP **instructions** carry retrieval guidance (field meanings, filters, query patterns). Voice and behaviour stay in the app's system prompt (`app/lib/constants.ts`).
- MCP names are immutable after save.
