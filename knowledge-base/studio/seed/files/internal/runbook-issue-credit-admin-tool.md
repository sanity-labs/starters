# Runbook: How to Issue a Credit in the Admin Tool

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Doc ID         | OPS-BIL-2026-06                                                         |
| Version        | v1.2                                                                    |
| Owner          | Support Operations                                                      |
| Document owner | Dana Okafor, Support Ops                                                |
| Reviewed with  | Jordan Hale, Finance Operations                                         |
| Last reviewed  | 2026-06-09                                                              |
| Classification | Internal - do not forward                                               |
| Related        | Billing Disputes runbook (OPS-BIL-2026-05), On-Call Roster (C rotation) |

## Purpose

The mechanics of issuing an account credit. This runbook does not tell you whether to issue one; the Billing Disputes runbook does. Come here after that decision is made.

## Who can

| Amount                       | Who                                         | Approval                     |
| ---------------------------- | ------------------------------------------- | ---------------------------- |
| Under $500                   | Support (tier 2 and above), Billing on-call | None beyond the ticket       |
| $500 and above               | Finance only                                | Finance approver in the tool |
| Any refund to payment method | Finance only                                | Finance approver in the tool |

The admin tool enforces this. If the Credit button is disabled for the amount you entered, you are not the right person to issue it. Do not split a $700 credit into two $350 credits. The tool flags it, Finance sees it, and it is the fastest way to lose your credit permission.

## Credit versus refund

A **credit** reduces the customer's next invoice. It is what Support issues.

A **refund** returns money to the original payment method within ten business days. Only Finance issues refunds, at any amount. If the customer wants money back rather than a credit, assign to Finance with the details, even if the amount is under $500.

Credits from billing errors that remain when a customer cancels are converted to refunds by Finance. Goodwill credits are not converted.

## Before you start

You have, from the Billing Disputes runbook:

- Ticket ID.
- Invoice ID the credit relates to.
- Amount, and confirmation it is under $500.
- Class: billing error, unused prepaid, or goodwill.
- Confirmation the request is inside the 30-day window from invoice date, or that it is a billing error Finance has approved outside the window.

Missing any of these: go back to the disputes runbook.

## Steps

1. Open the customer's workspace in the admin tool.
2. Go to **Administration → Billing → Credit**.
3. **Invoice.** Select the invoice from the dropdown. Credits must reference an invoice; unlinked credits are not permitted. If the invoice is not in the list, it is more than 12 months old or belongs to another workspace; stop and check.
4. **Amount.** Enter the amount in USD. The tool shows the invoice total and the remaining creditable balance. You cannot credit more than the invoice total minus prior credits on it.
5. **Reason code.** Pick one:

| Code           | Use for                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| BILLING_ERROR  | Duplicate, post-cancellation charge, wrong plan fee, usage on wrong workspace                    |
| UNUSED_PREPAID | Prepaid volume unused at cancel or downgrade                                                     |
| GOODWILL       | Customer configuration cases where we chose to help. Under $500, once per 12 months per account. |
| SERVICE_TERMS  | Finance only. Order form service commitments after an incident.                                  |
| OTHER          | Requires a note and Finance review. Avoid.                                                       |

6. **Ticket ID.** Required. The tool links the credit to the ticket and posts a note back to it.
7. **Note.** One or two sentences a Finance auditor could read cold: what happened, why this amount. "Duplicate invoice INV-2026-08-1132 issued after cancellation confirmed 2026-08-14; crediting full plan fee" is good. "Customer unhappy" is not.
8. **Preview.** The tool shows the credit, the invoice it applies to, and the customer's next projected invoice with the credit applied. Check the workspace name one more time.
9. **Confirm.** The credit posts immediately. The customer's Admins receive an automatic email with the amount and the reason category (not your note). The credit appears on the customer's Administration → Billing page under Credits.

## After

- The tool posts to the ticket. Add your customer-facing reply using the `billing-dispute-resolved` macro. Tell them the credit amount and that it applies to their next invoice.
- Do not tell them a date the credit will "arrive." It is not a payment; it reduces the next invoice on the billing date.
- If the customer replies asking for a refund instead, reassign to Finance. Do not reverse the credit yourself; Finance handles the conversion so it is not double counted.

## Reversing a credit

Only Finance can reverse a credit. If you issued one in error, post in `#support-ops` with the credit ID and assign the ticket to Finance the same day. Do not issue a negative credit and do not issue a second credit to "fix" the first.

## Things that go wrong

**Credit button disabled.** Amount is $500 or more, or you lack the permission tier, or the invoice already has a Finance hold on it. Hover shows which. Assign to Finance.

**Invoice not in the dropdown.** Wrong workspace (customer has more than one), or invoice older than 12 months. Check the invoice ID against the workspace. Anything older than 12 months is Finance.

**Customer asks for the credit on a different workspace.** Credits are per workspace and per invoice. A credit on workspace A cannot be applied to workspace B's invoice. Finance can handle cross-workspace situations for the same billing entity; assign to them.

**Customer cites a 45-day window.** That is the outdated Finance PDF (FIN-REF-2025-03). Current policy is 30 days from the invoice date. Handle per the Billing Disputes runbook. The admin tool's window check uses 30 days and will flag a request outside it; do not override the flag.

## Done when

- Credit posted with invoice, amount, reason code, ticket ID, and an auditable note.
- Customer replied to with the amount and "applies to your next invoice."
- Ticket status set to resolved, or reassigned to Finance if a refund was requested.

## Revision history

| Version | Date       | Change                                               |
| ------- | ---------- | ---------------------------------------------------- |
| v1.0    | 2025-10-14 | Initial runbook after admin tool credit flow shipped |
| v1.1    | 2026-02-03 | Added reason code table; added 45-day note           |
| v1.2    | 2026-06-09 | Added reversal section; added cross-workspace case   |
