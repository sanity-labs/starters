# MCP: `beacon-catalog`

GROQ mode. Customer support surface. Env var: `SANITY_MCP_SUPPORT_GROQ_URL`.

## Name

```
beacon-catalog
```

Names are immutable after save.

## Sources

Dataset: this project's `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET`. Nothing else — a Knowledge Base source on this MCP would be ignored.

Requires a deployed schema (`pnpm bootstrap` runs `sanity schema deploy`).

## groqFilter

A filter expression only (no `*[`, no projection, no ordering). `product` has no `status` field; `faq` does, and this is the customer surface, so only published FAQs pass:

```groq
_type == "product" || (_type == "faq" && status == "published")
```

## Instructions

```
This endpoint serves the Beacon product catalog (product) and customer FAQs (faq). It answers structured, filterable questions. Long-form how-to lives in a separate Knowledge Base endpoint; do not try to answer procedural questions from here.

product fields:
- title, slug.current, description
- planTier: "starter" | "growth" | "enterprise"
- priceMonthly: number, USD per month
- channels: array of "email" | "sms" | "push" | "in-app"
- seatLimit: number of included seats. 0 means unlimited, not zero.
- features: array of short strings

faq fields:
- question: string
- answer: Portable Text. Project it as text: "answerText": pt::text(answer)
- audience: array of "developer" | "admin" | "end-user"; empty means everyone
- products[]->title, topics[]->title for taxonomy

Query patterns:
- Filter first, then rank. For "which plan includes X under $N":
  *[_type == "product" && "sms" in channels && priceMonthly < 200] | order(priceMonthly asc){_id, title, planTier, priceMonthly, channels, seatLimit, description}
- For fuzzy or "similar to" questions, rank with hybrid search. text::semanticSimilarity() is only valid inside score():
  *[_type == "product"] | score(boost([title, description] match text::query($query), 2), text::semanticSimilarity($query)) | order(_score desc)[0...5]{_id, title, planTier, priceMonthly, description}
- FAQ lookup:
  *[_type == "faq"] | score(boost(question match text::query($query), 2), text::semanticSimilarity($query)) | order(_score desc)[0...3]{_id, question, "answerText": pt::text(answer)}

Never invent prices, plan names, seat limits, or refund windows. If no document matches, return an empty result and say so.
```
