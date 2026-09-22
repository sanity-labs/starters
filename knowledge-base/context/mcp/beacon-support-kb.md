# MCP: `beacon-support-kb`

Knowledge Base mode. Customer support surface. Env var: `SANITY_MCP_SUPPORT_KB_URL`.

## Name

```
beacon-support-kb
```

Names are immutable after save.

## Sources

Knowledge Base: **Beacon Customer Support** (see [`../knowledge-bases/beacon-customer-support.md`](../knowledge-bases/beacon-customer-support.md)). Nothing else — adding a dataset source here would switch the MCP to GROQ mode and drop the Knowledge Base.

## groqFilter

None. Knowledge Base mode is scoped by which Knowledge Bases the MCP serves, not by filter.

## Instructions

```
This endpoint serves the Beacon Customer Support Knowledge Base: grounded, customer-facing prose about onboarding, campaigns, workflows, deliverability, billing and refunds, data retention, and data export.

Use the outline from initial context to pick entry paths, then read only the entries you need. Entries already cite their sources; keep those citations in the answer.

The refund window is 30 days from the original invoice date. A finance PDF in this Knowledge Base says 45 days from the charge date; it is out of date and an Instruction records that. Do not quote 45 days.

Exact catalog facts (prices, plan tiers, channels, seat limits) and single-sentence FAQ answers are served by a separate GROQ endpoint. If a question is only about those, say the catalog is the better source rather than paraphrasing a number from prose.

Answer only from retrieved entries. If the outline has no relevant entry, say so and suggest contacting support. Never answer account-specific questions.
```
