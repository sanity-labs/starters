---
name: add-mcp-surface
description: Add another Context MCP pair (GROQ + Knowledge Base) to this starter. Use when adding a chat surface or a new agent that must not mix dataset and Knowledge Base sources on one endpoint.
---

# Add a Context MCP surface

This starter already ships two surfaces (support and ops). Each surface uses **two** MCP endpoints on one chat route: one GROQ, one Knowledge Base.

## Rule

An MCP serves one source type. If you attach a dataset source and Knowledge Base sources, the dataset wins and the Knowledge Bases are ignored, with no error. Put multiple sources on the **Knowledge Base**, not on the MCP.

## Steps

1. **Decide the question types.** Structured filters (plans, prices, review dates, FAQ facts) go on a GROQ MCP. Grounded prose (how-to, runbooks, PDFs) goes on a Knowledge Base MCP.
2. **Create or reuse a Knowledge Base** in the Context app. Write a one-to-two-sentence purpose. Attach dataset / website / file sources. Build. Resolve Issues.
3. **Create two MCPs** in the Context app:
   - GROQ: dataset source `PROJECT.DATASET`, a `groqFilter` predicate (not a full query), instructions for field meanings and hybrid search.
   - KB: only Knowledge Base sources. No `groqFilter`.
4. **Add env vars** in `app/.env.example` and `app/.env.local`:
   - `SANITY_MCP_<SURFACE>_GROQ_URL`
   - `SANITY_MCP_<SURFACE>_KB_URL`
5. **Add a chat route** that calls `handleChat` from `app/lib/chat-handler.ts`, or extend that helper with a new `Surface`. Rename generic tools so GROQ and KB do not collide (`groq_query` vs `knowledge_base_read` both exist; `initial_context` exists in both modes — inline it instead of merging the tool).
6. **Write a routing table** in the system prompt: which tool owns which facts.
7. **Verify** with `tools/list`. GROQ should not list `knowledge_base_read`. KB should not list `groq_query`.

## Auth

Organization API token with Context Viewer, server-side only. Project tokens fail with `403 contextGrantRequired`.

## Docs

- [Retrieval modes](https://www.sanity.io/docs/ai/sanity-context-retrieval-modes)
- [Configure an MCP](https://www.sanity.io/docs/ai/sanity-context-configure-mcp)
- [Content access](https://www.sanity.io/docs/ai/sanity-context-security)
