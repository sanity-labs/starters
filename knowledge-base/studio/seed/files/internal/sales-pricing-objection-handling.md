# Sales Note: Pricing Objection Handling

| Field          | Value                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Doc ID         | SAL-PRC-2026-02                                                                              |
| Version        | v2.0                                                                                         |
| Owner          | Sales Enablement                                                                             |
| Document owner | Sales Enablement, reviewed with Jordan Hale, Finance Operations                              |
| Last reviewed  | 2026-02-18                                                                                   |
| Classification | Internal - do not forward                                                                    |
| Related        | Competitive Note vs Legacy ESP (SAL-CMP-2026-01), Billing Disputes runbook (OPS-BIL-2026-05) |

## Ground rules

1. Prices are the list prices in the product catalog. Quote them exactly. Do not round, do not "about."
2. There are no discounts you can offer on your own. None. Anything off list goes through Finance on a deal desk request with a business case. This note is about reframing, not about lowering.
3. Never invent a refund, credit, or trial term. The customer-facing refund window is 30 days from the invoice date. Do not quote it as a selling point and do not quote any other number.

## The catalog

| Product       | Tier       | USD per month | Channels                 | Seats     |
| ------------- | ---------- | ------------- | ------------------------ | --------- |
| Segments      | Starter    | 49            | Email                    | 5         |
| Campaigns     | Growth     | 149           | Email, SMS, push         | 10        |
| Workflows     | Growth     | 179           | Email, SMS, push, in-app | 20        |
| Channels      | Growth     | 199           | Email, SMS, push, in-app | 15        |
| Developer API | Enterprise | 299           | Email, SMS, push         | Unlimited |
| Analytics     | Enterprise | 399           | Email, SMS, push, in-app | 50        |

Each product is priced separately and includes a message volume. Usage above it is billed per thousand at the rate on the invoice. Seats are per product. Seat limit of zero in the catalog means unlimited; say "unlimited" to the customer.

## Objections and responses

### "It is more expensive than what we pay now."

Ask what "what we pay now" includes. Legacy ESP contracts hide cost in list-size tiers, overage surprises, and the two or three tools bolted on for SMS and push. Build the comparison with them: their ESP plus their SMS vendor plus the sync tool plus the hours spent rebuilding lists. Beacon is one audience model; the price is for not having the seams.

If after that it is still more expensive, it is more expensive. Move to value, not to a discount you do not have.

### "Why is Analytics $399 when the ESP includes reporting?"

Because it is not the same thing. Included reporting shows opens and clicks. Analytics is conversion goals with attribution windows, cohort compare across segments, 25-month event retention, and CSV plus API export. If they only need opens and clicks, every Beacon product already includes the campaign report; they may not need Analytics on day one. Say that. Selling Analytics to a team that will not use it produces a churn-save ticket in six months.

### "Can we get a discount?"

"Not one I can give you. I can take a business case to our Finance team if there is something specific: a multi-year term, a volume commitment, a reference agreement. What would make the case?" Then listen. Do not hint at a number. Finance owns the number.

### "What about annual?"

Annual commitment is a Finance conversation and can be part of a deal desk request. Do not quote an annual price or a percentage. Say: "Annual terms exist. Let me bring Finance in with the specifics." That is the whole answer.

### "We only need email. Why pay for SMS and push?"

Then Segments at $49 is the product: email only, 5 seats, live segments. Campaigns at $149 adds SMS, push, and scheduling with A/B tests. If they are email only today and expect to stay that way, start them on Segments. Do not up-tier a customer into channels they will not use; unused channels are how a customer decides the product is expensive.

### "We need SMS but the Starter tier is our budget."

SMS is not on Starter. Segments is email only. If the budget is fixed at Starter, they do not get SMS this quarter. Be direct. Offer Campaigns at $149 as the smallest SMS-capable product and explain what else it adds. Note for reps: an old customer PDF (the SMS Sender Registration Primer, last reviewed 2024) says SMS is available on Starter with an add-on. It is not, there is no add-on, and the PDF is being corrected. If a prospect cites it, say the document is out of date.

### "The seat limits are tight."

Seats are per product. A team of 12 that needs Campaigns (10 seats) has two options: Channels (15 seats) if they also need in-app, or a seat-expansion request through Finance. Do not promise extra seats. Also check what the seats are for; Viewers count as seats, and a lot of "we need 12 seats" is eight people who only read reports and could share a dashboard export.

### "What happens if we send more than the included volume?"

Overage is billed per thousand at the plan rate on the invoice, metered at delivery. Undelivered messages are not billed. Paused campaigns do not bill the unsent remainder. Point them to the help article "Billing and subscription overview." Do not estimate their overage cost from memory; use the calculator in the deal tool.

### "Is there a refund if it does not work out?"

"There is a customer-facing refund policy: 30 days from the invoice date for billing errors and unused prepaid volume. Delivered messages are not refundable, which is standard. I would not plan a purchase around a refund; I would plan it around a pilot." Then propose a pilot scope. Do not go further into refund terms; Finance owns them.

### "Your competitor has a free tier."

True. Beacon does not. If free is a requirement, Beacon is not the tool for them today. Say it, keep the relationship, and set a check-in for when they outgrow free. Do not offer a "free" first month; that is a discount and you do not have one.

## Reframes that work

- **From price to seams.** Every integration between tools is a place where consent gets lost and a customer gets a message they should not have. Beacon's price buys the absence of those seams.
- **From per-product to per-outcome.** Ask what one recovered cart series or one reactivation campaign is worth per month. Most Growth customers cover the plan fee with one workflow.
- **From "expensive" to "predictable."** Metered at delivery, published seat limits, no list-size tiers. Finance buyers value predictable more than cheap.

## What to send after the call

- The catalog table above, as a formatted quote from the deal tool. Never a screenshot of this page.
- The help article "Billing and subscription overview."
- Nothing about refunds beyond the help article "Refunds and credits" if they asked. Never the Finance PDF; it is outdated.

## Escalation

Anything off list, annual, multi-year, volume commit, seat expansion, or custom retention: deal desk request to Finance with the business case. Turnaround is two business days. Tell the prospect that number.

## Revision history

| Version | Date       | Change                                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------ |
| v1.2    | 2025-06-30 | Added seat limits objection                                                                |
| v2.0    | 2026-02-18 | Added SMS on Starter note; tightened refund answer; removed the old "first month" language |
