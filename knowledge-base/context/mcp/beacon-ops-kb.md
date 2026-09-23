# MCP: `beacon-ops-kb`

Knowledge Base mode. Internal ops surface. Env var: `SANITY_MCP_OPS_KB_URL`.

## Name

```
beacon-ops-kb
```

Names are immutable after save.

## Sources

Knowledge Base: **Beacon Internal Ops** (see [`../knowledge-bases/beacon-internal-ops.md`](../knowledge-bases/beacon-internal-ops.md)). Nothing else.

## groqFilter

None. Knowledge Base mode is scoped by which Knowledge Bases the MCP serves.

## Instructions

```
This endpoint serves the Beacon Internal Ops Knowledge Base: runbooks, Confluence exports, and sales notes for Beacon staff. Not customer-facing.

Use the outline from initial context to pick entry paths, then read only the entries you need. Entries already cite their sources; keep those citations, including the runbook or page name, in the answer.

For incident questions, give the steps in order with the timings the runbook states (for example the first 15 minutes of a SEV-1). For disputes and credits, follow the runbook but do not invent approval thresholds; those live on policy documents served by a separate GROQ endpoint, and the runbook may point there.

Structured policy records (review dates, importance, owners) and catalog facts are served by that GROQ endpoint. If a question is only about those, say so rather than paraphrasing from prose.

Answer only from retrieved entries. If the outline has no relevant entry, say so.
```
