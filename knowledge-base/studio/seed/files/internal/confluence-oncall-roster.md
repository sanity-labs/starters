# On-Call Roster and Escalation

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Space          | Engineering / Operations / On-Call                        |
| Page ID        | 48431207                                                  |
| Labels         | on-call, roster, escalation, billing, deliverability, api |
| Page owner     | Theo Brandt, Platform Engineering                         |
| Last updated   | 2026-08-26 by Theo Brandt                                 |
| Exported       | Exported from Confluence on 2026-09-01                    |
| Classification | Internal - do not forward                                 |

## Contents

1. How the rotation works
2. The three rotations
3. Escalation
4. Handoff
5. Rotation-specific notes
6. Pager hygiene
7. Schedule

## 1. How the rotation works

One primary and one secondary per rotation. The week starts **Tuesday 17:00 UTC** and ends the following Tuesday 17:00 UTC. Tuesday, because Monday handoffs collided with weekend backlog and Friday handoffs sent people into the weekend without context.

The secondary is the previous week's primary. That way the secondary always knows what happened last week and can answer "is this the same thing as Thursday" without reading the whole channel.

Primary carries the pager. Secondary is reachable within 15 minutes but is not expected to be at a keyboard. Both are expected to be sober and within reach of a laptop for the whole week. Swap ahead of time if you cannot commit to that; see section 4.

## 2. The three rotations

| Rotation | Week           | Covers                                                                                                          | Primary skill                           |
| -------- | -------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A        | Deliverability | Email, SMS, push delivery paths; DNS and domain authentication; provider and carrier relationships; suppression | Channels engineer or Deliverability     |
| B        | API            | Rate limiting, webhooks, API keys, event ingestion, the admin tool                                              | Platform engineer                       |
| C        | Billing        | Metering, invoices, credits, refunds, plan changes, payment failures                                            | Billing engineer, with Finance backstop |

The three rotations run in parallel. Every week has an A primary, a B primary, and a C primary. The lettering is which rotation you are on, not which week it is.

Anything that does not fit a rotation goes to B. B is the default for "I do not know who owns this."

Security incidents page whichever rotation the affected system belongs to, plus the Security lead for SEV-1. See the Incident Response page.

## 3. Escalation

1. Pager fires to the primary.
2. **15 minutes** with no acknowledgement: pager escalates to the secondary automatically.
3. 15 more minutes with no acknowledgement: pager escalates to the rotation lead (A: Marcus Lindqvist, B: Theo Brandt, C: Jordan Hale as Finance backstop, with the Billing engineering lead).
4. SEV-1, at any point: also pages the Security lead (Priya Shah) and the Engineering director.

You can escalate manually at any time by paging the secondary from the incident channel. Do it when you are stuck, not when you are exhausted. Both are fine reasons; the first one is earlier.

Cross-rotation help: page the other rotation's primary through the pager, not through DMs. Pager pages are logged; DMs are not.

## 4. Handoff

Handoff happens in `#on-call` at or shortly after Tuesday 17:00 UTC. The outgoing primary posts:

- Open incidents and their channels.
- Anything paused, flagged off, or held that needs to be resumed.
- Customers who were promised a follow-up and by when.
- Known flaky alerts that fired this week and what they turned out to be.

The incoming primary acknowledges in the thread. Until they do, the outgoing primary still has the pager.

Swaps: arrange them in `#on-call` at least 48 hours ahead and update the pager schedule yourself. A swap that exists only in Slack does not exist.

## 5. Rotation-specific notes

### A: Deliverability

- Provider status pages first. Half of "email is down" is a provider incident, and paging the provider is faster than debugging our side.
- Never resume a held queue all at once. Release gradually. See Incident Response, section 7.
- Customer domain authentication problems are Support's job unless the DNS check itself is broken. Do not spend on-call hours reading a customer's zone file.
- Blocklist notifications: acknowledge, identify the workspace responsible, freeze that workspace's email sends, hand to Deliverability Complaint Handling (Customer Success runbook) in the morning.

### B: API

- 429 storms from one key are the customer's client, not our outage. Check the key's request pattern in the admin tool before declaring anything. Default limit is 100 rps per project; the response carries `Retry-After`.
- Webhook endpoint failures auto-disable after 24 hours and email the customer's Admins. That is by design. Do not re-enable a customer's endpoint for them.
- A leaked key found in a public repository is revoked automatically by the scanner. If you see the alert, confirm the revoke landed and the Admin email went out. If the key was used before revoke, open a SEV-2 and check the audit log.
- Admin tool access issues are B. Nobody else owns the admin tool.

### C: Billing

- **Confirm the invoice before anything else.** Invoice ID, workspace, the usage that drove it. Most "wrong invoice" pages are correct invoices the customer did not expect.
- Credits under **$500** follow the Billing Disputes runbook and can be issued by Support or by you. **$500 and above is Finance.** Page Jordan Hale during business hours; outside them, hold and hand to Finance in the morning. No overnight refund is urgent enough to skip Finance.
- The customer-facing refund window is **30 days from the invoice date**. Do not invent a window on the call. Do not quote the outdated finance PDF that says 45 days; it is wrong and it is being pulled from the customer file share.
- Refunds return to the original payment method within ten business days. Credits apply to the next invoice. That is the whole set of facts you should be stating at 2 a.m.
- Payment failures: the dunning sequence runs automatically for 14 days. Do not manually suspend a workspace for non-payment; Finance does that.
- Metering bugs (double counting, wrong rate) are SEV-2 if they affect more than one workspace. Stop the invoice run if it has not gone out. If it has, do not issue mass credits from on-call; Finance runs those as a batch with a customer email.

## 6. Pager hygiene

- Every page gets an ack, even the ones you know are noise. Silence looks like an outage to the secondary.
- Every noisy alert gets a ticket. If it fired three times this week and meant nothing three times, fix the alert or delete it. Post the ticket in handoff.
- Do not mute the pager. Adjust the alert.
- Log what you did in the incident channel or in `#on-call`, with timestamps, as you do it. Your future self at the write-up will thank you.

## 7. Schedule

The live schedule is in the pager tool. The table below is the published plan for the current quarter and is exported for the wiki; if they disagree, the pager tool wins.

| Week starting (Tue 17:00 UTC) | A primary     | B primary   | C primary |
| ----------------------------- | ------------- | ----------- | --------- |
| 2026-09-01                    | M. Lindqvist  | T. Brandt   | R. Osei   |
| 2026-09-08                    | S. Achterberg | L. Moreau   | D. Okafor |
| 2026-09-15                    | K. Tanaka     | T. Brandt   | R. Osei   |
| 2026-09-22                    | M. Lindqvist  | A. Ferreira | D. Okafor |
| 2026-09-29                    | S. Achterberg | L. Moreau   | R. Osei   |

Secondary each week is the previous week's primary on the same rotation.

Holidays: the rotation does not stop. If a public holiday falls in your week, arrange a swap for that day in `#on-call` ahead of time.

**Done when** (for handoff): open items posted, incoming primary acked, pager schedule matches the post.
