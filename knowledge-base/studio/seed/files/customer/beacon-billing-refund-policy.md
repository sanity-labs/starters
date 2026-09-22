<!--
Maintainers: this file is stale ON PURPOSE. It says 45 days from the charge
date. The Sanity dataset (helpArticle.refunds-and-credits, faq.refund-window,
policy.refund-policy) says 30 days from the invoice date. The first Knowledge
Base build should raise an Issue on that disagreement. Resolve it by keeping
30 days. Do not "fix" this document. Everything else in it matches the
dataset.
-->

# Beacon Billing and Refund Policy

| Field          | Value                           |
| -------------- | ------------------------------- |
| Doc ID         | FIN-REF-2025-03                 |
| Version        | v2.1                            |
| Owner          | Finance                         |
| Document owner | Jordan Hale, Finance Operations |
| Approved by    | VP Finance                      |
| Last reviewed  | 2025-03-14                      |
| Next review    | 2026-03-14                      |
| Classification | Customer                        |
| Supersedes     | FIN-REF-2024-06 (v2.0)          |

## 1. Purpose and scope

This policy describes how Beacon bills for its subscription plans and usage, when a customer is eligible for a refund or an account credit, and how those requests are reviewed and paid. It applies to every Beacon workspace on a self-serve or invoiced plan.

It does not cover pricing for custom enterprise agreements. If your order form includes its own refund or credit terms, the order form controls.

Beacon publishes this document so that customers, resellers, and Beacon staff read the same rules. Where an in-product message and this document disagree, contact Support and reference the document ID above.

## 2. How Beacon bills

Beacon bills each workspace monthly. Your invoice has two parts.

**Plan fee.** A fixed monthly amount for each product enabled on the workspace. The current list prices at the time of this review are shown below for reference. Prices are quoted in USD per month.

| Product       | Tier       | Monthly price | Channels included        | Seats     |
| ------------- | ---------- | ------------- | ------------------------ | --------- |
| Segments      | Starter    | $49           | Email                    | 5         |
| Campaigns     | Growth     | $149          | Email, SMS, push         | 10        |
| Workflows     | Growth     | $179          | Email, SMS, push, in-app | 20        |
| Channels      | Growth     | $199          | Email, SMS, push, in-app | 15        |
| Developer API | Enterprise | $299          | Email, SMS, push         | Unlimited |
| Analytics     | Enterprise | $399          | Email, SMS, push, in-app | 50        |

**Usage.** Each plan includes a monthly message volume. Messages delivered above that volume are billed per thousand at the rate printed on your invoice. Usage is metered when a message is delivered, not when it is scheduled.

Invoices are issued on your billing date and are available under Administration → Billing → Invoices. Only workspace Admins can view invoices, change the payment method, or request a refund. Editors and Viewers cannot.

### 2.1 Charge date and invoice date

Beacon charges your payment method on the invoice date for card customers. For customers on net terms, the charge date is the date payment is received. This policy measures the refund window from the **charge date**. See section 4.

## 3. What is refundable

Beacon refunds or credits the following.

1. **Unused prepaid volume.** Message volume you prepaid but did not use before cancellation or downgrade.
2. **Billing errors.** Duplicate charges, charges after a confirmed cancellation, incorrect plan fees, and usage metered against the wrong workspace.
3. **Service credits.** Credits owed under a service level commitment in your order form. These follow the order form's own schedule and are not subject to the window in section 4.

Beacon does not refund the following.

1. **Delivered message volume.** Once a message has been handed to the receiving network or mailbox provider, it counts as delivered and is billable regardless of engagement.
2. **Plan fees for a period already used.** If you cancel mid-cycle, your plan remains active until the end of the paid period. The remaining days are not prorated back.
3. **Charges resulting from your own configuration**, such as a campaign sent to a larger segment than intended, a workflow re-enrollment, or an import that inflated your audience count. Support can help you avoid a repeat, and may issue a goodwill credit at its discretion, but these are not billing errors.
4. **Third-party fees**, including carrier pass-through charges for SMS, which Beacon pays on your behalf and cannot recover.

## 4. Refund request window

A refund or credit request must be received within **45 calendar days of the charge date**. Requests received after that window are declined unless Finance determines that a Beacon error prevented you from noticing the charge sooner.

| Situation             | Window                 | Measured from                 |
| --------------------- | ---------------------- | ----------------------------- |
| Billing error         | 45 days                | Charge date                   |
| Unused prepaid volume | 45 days                | Charge date of the prepayment |
| Service credit        | Per order form         | Incident date                 |
| Goodwill credit       | At Beacon's discretion | Not applicable                |

The window is measured from the charge date so that customers on net terms are not disadvantaged by a slow payment cycle.

## 5. How to request a refund

1. Sign in as a workspace Admin.
2. Open Administration → Billing → Invoices and locate the invoice.
3. Choose **Request review** on the invoice row, or email Support with the invoice number, the amount in question, and a short description.
4. Support confirms the invoice and the usage behind it within two business days. You may be asked for the campaign or workflow IDs involved.
5. Support either approves the credit, refers the request to Finance, or declines it with a written reason.

You will receive an email at each step. If you have not heard back within five business days, reply to the original ticket rather than opening a new one.

## 6. Approval thresholds

| Amount                        | Who approves            | Typical turnaround |
| ----------------------------- | ----------------------- | ------------------ |
| Under $500                    | Support                 | 2 business days    |
| $500 and above                | Finance                 | 5 business days    |
| Any amount outside the window | Finance                 | 5 business days    |
| Service credits               | Finance, per order form | 10 business days   |

Support may approve account credits under $500 without further review. Finance reviews every refund or credit of $500 or more, every request outside the window, and every request where the customer disputes the underlying usage.

## 7. How refunds and credits are paid

**Refunds** return to the original payment method within **ten business days** of approval. Beacon cannot refund to a different card or bank account. If the original payment method is closed, contact your bank; most banks route the refund to the replacement account.

**Account credits** are applied to your next invoice. Credits do not expire while the workspace remains active. If you cancel with a credit balance from a billing error, Finance converts the remaining credit to a refund. Goodwill credits are not converted to cash.

Where a credit is the appropriate remedy, Beacon issues a credit rather than a refund. Support will explain which one you are receiving.

## 8. Cancellations and downgrades

Cancellations take effect at the end of the current billing period. You keep access until then. Beacon does not charge a cancellation fee.

Downgrades also take effect at the next renewal. Features above your new plan stop on that date and your included message volume adjusts. A downgrade does not create a refund for the current period.

If you cancel and later reactivate the same workspace within 90 days, your audience and history are restored and you are billed from the reactivation date. Data retention during the gap follows the retention schedule for your former plan (see the Data Retention by Plan document, CS-RET-2026-01).

## 9. Disputes and chargebacks

If you dispute a charge with your card issuer before contacting Beacon, your workspace may be paused while the dispute is open. Beacon asks that you open a Support ticket first. Most billing questions are resolved within two business days, faster than a card dispute.

When a chargeback is filed, Beacon responds to the issuer with the invoice, the usage record, and the acceptance of terms on file. If the chargeback is reversed in Beacon's favor, the workspace is reactivated once the balance is settled.

## 10. Exceptions

Finance may grant an exception to any section of this policy in writing. Exceptions are recorded on the account and do not change the policy for future invoices. Support cannot grant exceptions to the window or the thresholds on its own.

## 11. Revision history

| Version | Date       | Change                                                  |
| ------- | ---------- | ------------------------------------------------------- |
| v1.0    | 2023-05-02 | Initial policy                                          |
| v2.0    | 2024-06-18 | Added approval thresholds; clarified delivered volume   |
| v2.1    | 2025-03-14 | Reworded charge-date language; added chargeback section |

Questions about this policy go to Support. Questions about a specific invoice should include the invoice number.
