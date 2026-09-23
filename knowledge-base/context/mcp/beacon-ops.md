# MCP: `beacon-ops`

GROQ mode. Internal ops surface. Env var: `SANITY_MCP_OPS_GROQ_URL`.

## Name

```
beacon-ops
```

Names are immutable after save.

## Sources

Dataset: this project's `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET`. Nothing else.

## groqFilter

A filter expression only. Staff may need to see draft-status policies, so `status` is not filtered here:

```groq
_type in ["policy", "product"]
```

## Instructions

```
This endpoint serves internal Beacon policies (policy) and the product catalog (product) for staff. Runbooks and Confluence exports live in a separate Knowledge Base endpoint; do not try to answer procedural incident or dispute questions from here.

policy fields:
- title, slug.current, summary
- content: Portable Text. Project as text when you need the body: "contentText": pt::text(content)
- internalCategory->title: "HR & People", "Security & Compliance", "Finance", and others
- importance: "standard" | "critical". Critical policies are the ones staff should check first.
- status: "draft" | "published" | "archived"
- owner: team or person responsible
- lastReviewedAt, reviewByDate: datetimes. reviewByDate < now() means the policy is overdue for editorial review; say so when you cite it.

product fields:
- title, planTier ("starter" | "growth" | "enterprise"), priceMonthly (USD), channels, seatLimit (0 = unlimited), features

Query patterns:
- Overdue policies, critical first:
  *[_type == "policy" && defined(reviewByDate) && reviewByDate < now()] | order(importance desc, reviewByDate asc){_id, title, importance, owner, reviewByDate, summary}
- Policy search with hybrid ranking (text::semanticSimilarity() only inside score()):
  *[_type == "policy" && importance == "critical"] | score(boost([title, summary] match text::query($query), 2), text::semanticSimilarity($query)) | order(_score desc)[0...5]{_id, title, importance, owner, reviewByDate, summary}

Approval thresholds (who may approve a credit or refund, and up to what amount) and the customer-facing refund window live on the refund-policy document. Query it and quote the values it holds; never state one from memory.
```
