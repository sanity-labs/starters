# Sales Note: Positioning Beacon Against a Legacy ESP

| Field          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Doc ID         | SAL-CMP-2026-01                                                                     |
| Version        | v1.3                                                                                |
| Owner          | Sales Enablement                                                                    |
| Document owner | Sales Enablement, with Product Marketing                                            |
| Last reviewed  | 2026-01-14                                                                          |
| Classification | Internal - do not forward                                                           |
| Related        | Pricing Objection Handling (SAL-PRC-2026-02), Deliverability Guide (CS-DEL-2026-02) |

## What this note is

How to sell against an incumbent email service provider that the prospect has used for years. "Legacy ESP" here means any email-first tool where SMS, push, and in-app were bolted on later and the audience lives in lists rather than in one model. Do not name the competitor in written materials. Describe the pattern; the prospect will name it themselves.

This is a positioning note, not a feature comparison. Feature comparisons age in a quarter. Positioning holds.

## The pattern you are selling against

Ask three questions in discovery. The answers tell you whether this note applies.

1. "How many places does a customer's email address live in your stack today?" Legacy ESP shops answer with a number above one, usually with a sigh.
2. "When someone unsubscribes from SMS, what happens to their email?" If the answer is "nothing" or "we have a sync job," they have the problem.
3. "Who owns deliverability?" If the answer is "the ESP handles it" and they cannot name their DMARC policy, they are exposed and do not know it.

## Beacon's position in one paragraph

One audience model. Every channel reads from and writes to the same contact, the same consent, the same events. A workflow can start with an email, branch on a click, send an SMS, and suppress the push, without a sync job in the middle. That is the whole pitch. Everything else is proof.

## Proof points, by buyer

**Marketing lead.** Segments are live, not lists. A segment updates itself as contact data changes. Show a segment with a behavioral filter and then track an event through the API in the demo; the contact appears in the segment within seconds. Legacy ESP shops spend hours a week rebuilding lists.

**Lifecycle or CRM manager.** Workflows with event triggers, conditional splits, and wait steps across all four channels. Show pause and resume with Spread over. They have been burned by a stuck journey that fired 3,000 messages at once when it resumed.

**Developer or platform owner.** One REST API, one webhook signature scheme, one set of scopes. Default 100 requests per second with `Retry-After` on 429, batch endpoints for backfills. Show the go-live checklist from the API Quickstart (DEV-API-2026-06). Developers trust a vendor who tells them how to verify a signature before they ask.

**Compliance or IT.** Consent is a field on the contact, enforced in the product: no consent status, no email campaign. Suppression is workspace-wide across channels. Retention is configurable downward in the product (Data Retention by Plan, CS-RET-2026-01). Contact-level export and deletion are self-serve (Workspace Data Requests, CS-DSR-2026-03). Do not claim compliance with any specific regulation. Say Beacon gives them the controls; their counsel decides what is required.

**Finance.** Transparent per-product pricing with published seat limits. Usage metered at delivery. Delivered volume is billable, undelivered is not, paused campaigns do not bill unsent contacts. That predictability is worth stating out loud; legacy ESP contracts are famous for surprise overages and list-size tiers.

## Where the legacy ESP is stronger (and what to say)

Be honest about these. Prospects have already heard the competitor's version.

| Their strength                                                         | Our honest response                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Huge template library and drag-and-drop editor with 15 years of polish | Ours is good and getting better. If their team's job is building 40 templates a week, let them say so; we may not be the fit. Most teams build five.                                                              |
| Deep integration with one specific commerce platform                   | Ask which one. Beacon's API and webhooks cover the data flow; a native app may not exist. Do not promise one.                                                                                                     |
| Free tier and a very cheap entry plan                                  | Beacon's entry is Segments at $49 per month, email only, 5 seats. If they need free, we are not their tool today. Say so and stay in touch.                                                                       |
| Years of their own sending reputation on the incumbent                 | Real. Warming a new domain takes weeks. Walk them through the warming table in the Deliverability Guide and offer a phased migration: transactional first, then marketing, with the old tool running in parallel. |

## Migration story

The migration objection is the real objection. Address it before they raise it.

1. Export contacts with consent from the incumbent. Beacon imports CSV with a consent column mapped (Segments → Import).
2. Authenticate a new sending subdomain in Beacon while the old tool keeps sending. Domain Authentication Checklist (CS-DNS-2026-05). Their IT owns the DNS step; get that name in discovery.
3. Warm the new domain with engaged contacts for two to three weeks. Old tool continues to the rest.
4. Move transactional templates through the API, then marketing campaigns, then workflows.
5. Cut over. Keep the incumbent read-only through one renewal cycle for reporting history.

Onboarding runs the 30-day motion (Customer Success playbook). Typical migration from a legacy ESP is 30 to 60 days, with the incumbent overlap being the main cost. Say that number; it is the one they are afraid to ask about.

## Things not to say

- Do not name competitors in writing, in decks, or in recorded calls.
- Do not claim deliverability rates. Beacon does not publish cross-customer benchmarks, and the Deliverability Guide says why.
- Do not claim compliance with a named regulation.
- Do not promise a native integration that does not exist. Check with Product.
- Do not disparage the incumbent's security. If a prospect brings up an incumbent's incident, say Beacon's process is on the trust center and move on.
- Do not quote refund or credit terms from memory. The customer-facing refund window is 30 days from invoice date; if it comes up, point to the help article and involve Finance for anything contractual.

## Discovery-to-demo checklist

| Done | Item                                                                                      |
| ---- | ----------------------------------------------------------------------------------------- |
|      | Counted where the email address lives today                                               |
|      | Asked the unsubscribe-across-channels question                                            |
|      | Identified who owns DNS                                                                   |
|      | Identified which channels are in scope (email only is Segments; SMS or push needs Growth) |
|      | Chose the demo path: live segment plus API event, or workflow pause and resume            |
|      | Sized migration honestly: 30 to 60 days with overlap                                      |

## Revision history

| Version | Date       | Change                                                                     |
| ------- | ---------- | -------------------------------------------------------------------------- |
| v1.1    | 2025-05-20 | Added compliance buyer section                                             |
| v1.2    | 2025-10-07 | Added "where they are stronger" table                                      |
| v1.3    | 2026-01-14 | Added migration story and refund line after a deal quoted the wrong window |
