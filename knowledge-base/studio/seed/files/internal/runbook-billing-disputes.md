# Runbook: Billing Disputes

| Field          | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Doc ID         | OPS-BIL-2026-05                                                                         |
| Version        | v3.2                                                                                    |
| Owner          | Support Operations                                                                      |
| Document owner | Dana Okafor, Support Ops                                                                |
| Reviewed with  | Jordan Hale, Finance Operations                                                         |
| Last reviewed  | 2026-05-19                                                                              |
| Classification | Internal - do not forward                                                               |
| Related        | How to Issue a Credit (OPS-BIL-2026-06), On-Call Roster, policy.refund-policy in Studio |

## Purpose

How Support handles a customer who says an invoice is wrong, wants a refund, or wants a credit. Covers triage, the decision paths by amount and window, what you may say, and what goes to Finance.

## When to use

Any ticket tagged `billing-dispute`, any chat where the customer mentions a refund or credit, and any C-rotation page about a customer invoice. If the customer has already filed a chargeback with their card issuer, use this runbook and also notify Finance immediately; see step 6.

## The facts you may state

Memorize these. They come from the refund policy document in Studio, which is the source of truth. Nothing else is.

- Refund or credit requests are accepted within **30 days of the original invoice date**.
- Qualifying charges: unused prepaid volume and billing errors.
- **Delivered message volume is not refundable.**
- Refunds go back to the **original payment method within ten business days**. Credits apply to the next invoice.
- Support may approve credits **under $500**. **$500 and above** goes to Finance.

### Do not quote 45 days

An outdated Finance PDF (FIN-REF-2025-03, v2.1) says 45 days from the charge date. That document was superseded and is being removed from the customer file share. It still turns up in customer searches and in old ticket macros. If a customer cites it, say: "That document is out of date. The current policy is 30 days from the invoice date." Then apply the current policy. Do not argue about which date the window is measured from; the answer is invoice date.

If you find a macro, help article draft, or internal page still saying 45 days, post the link in `#support-ops` so it gets fixed.

## Steps

### 1. Confirm the invoice

Before you respond with anything substantive:

- Pull the invoice in the admin tool: Administration → Billing → Invoices on the customer's workspace. Note the invoice ID, invoice date, and amount.
- Open the usage breakdown for that invoice. Identify what drove the charge: plan fee, overage volume, carrier pass-through, a plan change.
- Check whether the customer is inside the 30-day window. Count from the invoice date, not from when they noticed, not from the charge date.
- Check the account notes for prior credits in the last 12 months.

Most disputes are correct invoices the customer did not expect. A campaign sent to a bigger segment than planned. A workflow that re-enrolled. An overage they did not know they were near. Confirming first means you can explain rather than apologize.

### 2. Classify

| Class                  | Definition                                                            | Examples                                                                                                     |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Billing error          | Beacon charged something that should not have been charged            | Duplicate invoice; charge after confirmed cancellation; wrong plan fee; usage metered to the wrong workspace |
| Unused prepaid         | Customer prepaid volume and did not use it before cancel or downgrade | Annual volume block unused at cancellation                                                                   |
| Customer configuration | Charge is correct; customer did not intend the usage                  | Oversized segment; workflow restart; import inflated audience                                                |
| Outage or degradation  | Customer believes an incident cost them                               | Sends delayed during a SEV; messages not delivered during provider outage                                    |
| Delivered volume       | Customer wants delivered messages refunded                            | "Nobody opened it"; "we sent the wrong message"                                                              |

### 3. Decide the path

| Class                          | Inside 30 days                                                                                                           | Outside 30 days                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Billing error, under $500      | Issue credit. Log. Done.                                                                                                 | Escalate to Finance with a note that the error was ours; Finance usually approves. |
| Billing error, $500 and above  | Escalate to Finance                                                                                                      | Escalate to Finance                                                                |
| Unused prepaid, under $500     | Issue credit                                                                                                             | Escalate to Finance                                                                |
| Unused prepaid, $500 and above | Escalate to Finance                                                                                                      | Escalate to Finance                                                                |
| Customer configuration         | Explain. No credit by default. Goodwill credit under $500 allowed once per 12 months if the account is in good standing. | Explain. No credit.                                                                |
| Outage or degradation          | Do not decide. Finance applies order form service terms after the incident review. Tell the customer that.               | Same                                                                               |
| Delivered volume               | Decline. Explain that delivered volume is not refundable.                                                                | Decline.                                                                           |

"Escalate to Finance" means: assign the ticket to the Finance queue with the invoice ID, the class, the amount, the window status, and your recommendation. Do not tell the customer the outcome before Finance decides. Say "I have sent this to our Finance team for review. You will hear back within five business days."

### 4. Issue the credit (under $500 only)

Follow How to Issue a Credit (OPS-BIL-2026-06). Short version: Administration → Billing → Credit, reason code, amount, ticket ID, confirm. Credits under $500 do not need a second approver. Credits are applied to the next invoice; if the customer wants a refund to their card instead, that is a Finance action regardless of amount.

### 5. Respond

Use the `billing-dispute-resolved` or `billing-dispute-escalated` macro. Include the invoice ID, what you found, what you did, and (for credits) when it will appear. For declines, explain which rule applied and link the help article "Refunds and credits." Do not link the Finance PDF.

Never speculate about a refund window, a threshold, or a timeline that is not in the facts list above.

### 6. Chargebacks

If the customer has disputed the charge with their card issuer:

- Notify Finance the same day. Use the `chargeback` tag.
- Do not issue a credit. A credit plus a reversed charge is a double refund.
- Tell the customer that Beacon will respond to the issuer, and that the fastest resolution is usually to withdraw the chargeback and let Support resolve the ticket directly. Do not pressure them.
- Finance decides whether the workspace is paused while the chargeback is open. Support does not pause workspaces for billing reasons.

## Escalation

- Amount $500 or more: Finance queue.
- Outside 30 days: Finance queue.
- Outage-related: Finance queue after the incident write-up is filed; link the write-up.
- Customer threatens legal action or names a regulator: Finance queue plus Security & Compliance, same day.
- You cannot find the invoice or the usage does not add up: C-rotation on-call. Might be a metering bug. That is an incident, not a dispute.

## Done when

- Invoice confirmed and usage understood.
- Class and path recorded in the ticket.
- Credit issued (under $500, inside window) or ticket assigned to Finance with a complete note.
- Customer told what happened and what happens next, with no numbers outside the facts list.
- Any stale 45-day reference you encountered posted to `#support-ops`.

## Revision history

| Version | Date       | Change                                                           |
| ------- | ---------- | ---------------------------------------------------------------- |
| v3.0    | 2025-08-11 | Rewrote paths table; added chargeback section                    |
| v3.1    | 2026-01-20 | Added "do not quote 45 days" after the FIN-REF-2025-03 confusion |
| v3.2    | 2026-05-19 | Added goodwill credit limit; clarified outage path               |
