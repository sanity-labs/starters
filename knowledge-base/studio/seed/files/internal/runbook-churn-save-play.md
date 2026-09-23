# Runbook: Churn-Save Play (Usage Drop)

| Field          | Value                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Doc ID         | OPS-CS-2026-04                                                                                                           |
| Version        | v1.4                                                                                                                     |
| Owner          | Customer Success                                                                                                         |
| Document owner | Customer Success Leadership                                                                                              |
| Last reviewed  | 2026-04-22                                                                                                               |
| Classification | Internal - do not forward                                                                                                |
| Related        | New Customer Onboarding Motion, Pricing Objection Handling (SAL-PRC-2026-02), Billing Disputes runbook (OPS-BIL-2026-05) |

## Purpose

What to do when a workspace's usage drops sharply. A usage drop is the earliest reliable churn signal we have, usually 60 to 90 days ahead of a cancellation. This play turns the alert into a conversation before the customer has decided.

## Trigger

The CS dashboard fires a `usage-drop` alert when a workspace's delivered message volume over the trailing 28 days is **40 percent or more below** its previous 28-day period, and the workspace has been active for at least 90 days. The alert lands in the account owner's queue with the two volume figures and a link to the workspace.

Alerts also fire on: no campaign sent in 30 days (Growth and above), all workflows paused for 14 days, Admin seat count dropping to one, or a downgrade request logged in Billing.

## When not to run the play

- Known seasonality noted on the account (a retailer after a holiday peak). Log and skip.
- Customer told us in advance (a migration pause, a rebrand). Log and skip.
- Workspace under Acceptable Use review or suspension. Deliverability owns that conversation; do not add a second one.
- Workspace in the first 90 days. That is onboarding, not churn.

## Steps

### 1. Diagnose before you call (same day)

Ten minutes in the admin tool. You are looking for the reason, not the confirmation.

| Check                        | Where                             | What it tells you                                                                             |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Which channel dropped        | Analytics overview, by channel    | One channel down is a delivery or registration problem; all channels down is a decision       |
| Campaign send dates          | Campaigns list                    | Stopped abruptly on a date, or tapered                                                        |
| Workflow status              | Workflows list                    | Paused workflows with Active contacts means they stopped on purpose and did not exit contacts |
| Authentication               | Channels → Email → Authentication | A record that dropped explains an email-only decline                                          |
| Delivery and complaint rates | Last five campaign reports        | A bad send followed by silence means they got scared                                          |
| Members and logins           | Administration → Members          | Last login dates. The champion may have left.                                                 |
| Billing                      | Administration → Billing          | Recent overage, failed payment, open dispute, downgrade request                               |
| Tickets                      | Support tool                      | Open or recently closed tickets, especially billing and deliverability                        |

Write one sentence in the account record: "Usage dropped because \_\_\_ (hypothesis)." You will be wrong a third of the time. Write it anyway.

### 2. Classify

| Type            | Signal                                                                | Play                                                                   |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Technical       | One channel down, auth dropped, credential expired, webhook disabled  | Fix it. Support ticket on their behalf. Call to tell them it is fixed. |
| Champion loss   | Last login weeks ago; Admin left; new names in tickets                | Find the new owner. Re-run a short onboarding.                         |
| Bad experience  | Deliverability complaint, billing dispute, incident during their send | Address the experience first. Do not pitch.                            |
| Budget or value | Downgrade request, "what do we get for this," seat reduction          | Value conversation. See step 4.                                        |
| Silent decision | Everything paused, no tickets, no logins                              | Direct call. Ask.                                                      |

### 3. Reach out (within two business days of the alert)

Email the primary contact and the Admin, if different. Short. Name the specific thing you saw: "I noticed your email volume dropped about half since mid-August and your welcome workflow has been paused since the 20th." Ask for 20 minutes. Do not attach a deck.

No reply in three business days: call. No answer: message the exec sponsor from the kickoff record. No reply after that: mark at-risk and set a 14-day recheck.

### 4. The conversation

Open with what you found. Then ask what changed. Then listen.

**Technical.** Show them it is fixed, or fix it together on the call. Confirm they know where the Authentication page is. Most technical drops end with a relieved customer.

**Champion loss.** Ask who owns customer messaging now. Book a 45-minute working session with that person and their Admin. Run days 6 to 30 of the onboarding motion in compressed form: one real campaign, one live workflow. Send the Campaign Analytics Glossary (CS-ANL-2025-10) afterward.

**Bad experience.** Acknowledge what happened without defending it. If it was a billing dispute, confirm where it stands with the Billing Disputes runbook; do not reopen the decision or promise a credit on the call. Credits under $500 are Support's call, above that is Finance, and the customer-facing refund window is 30 days from invoice date. If it was deliverability, walk their authentication and warming with them using the Deliverability Guide (CS-DEL-2026-02).

**Budget or value.** Pull the numbers before the call: conversions attributed to their workflows, revenue if their goal events carry a value, campaigns sent versus plan volume. Show what the plan produced. If a product is unused, say so and offer to remove it. Removing an unused product is a save. Pushing them to keep paying for it is a cancellation in three months. Right-sizing options: Segments at $49 if they are email only and low volume; removing Analytics if they never opened it. No discounts; anything off list goes to Finance as a deal desk request, and you should not hint at a number.

**Silent decision.** Ask directly: "Are you considering moving off Beacon?" You will get a real answer more often than you expect. If yes, ask what the alternative solves that we do not. Log it verbatim for Product. Then ask for a 30-day pilot of whatever they think is missing before they switch.

### 5. Act and follow up

Within one business day of the call, send a summary: what you heard, what you will do, by when. Do the things. Recheck usage at 14 and 28 days. Update the account record with the outcome: saved, right-sized, at-risk, churned, with the reason in one sentence.

## Do not

- Do not lead with a discount you do not have. Finance owns pricing. See Pricing Objection Handling (SAL-PRC-2026-02).
- Do not promise a feature or a date. Log the request; Product prioritizes.
- Do not promise credits. Route to Billing Disputes.
- Do not send a survey instead of calling. The survey tells you they are unhappy; you already know.
- Do not run the play on a workspace under Acceptable Use review.

## Escalation

- Budget conversations that need anything off list: deal desk request to Finance.
- Customer names a competitor and a switch date: CS lead plus the account executive, same day.
- Customer's drop traces to a Beacon incident: link the write-up, involve Finance for any service terms in the order form. Do not decide it yourself.
- Workspace with more than $5,000 monthly plan fees: CS lead joins the call.

## Done when

- Diagnosis sentence in the account record.
- Type classified.
- Customer reached (or three attempts logged plus exec sponsor).
- Summary sent within one business day of the call.
- Outcome recorded at 28 days.

## Revision history

| Version | Date       | Change                                                               |
| ------- | ---------- | -------------------------------------------------------------------- |
| v1.2    | 2025-07-08 | Changed trigger from 30 to 40 percent to cut false alarms            |
| v1.3    | 2025-12-02 | Added champion loss type                                             |
| v1.4    | 2026-04-22 | Added "do not run" cases; aligned billing lines with OPS-BIL-2026-05 |
