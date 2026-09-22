# SEV Communications and Status Page Rules

| Field          | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| Space          | Engineering / Security / Incident Management               |
| Page ID        | 48431301                                                   |
| Labels         | incident, communications, status-page, sev1, sev2, support |
| Page owner     | Priya Shah, Security Lead                                  |
| Last updated   | 2026-07-30 by Priya Shah                                   |
| Exported       | Exported from Confluence on 2026-08-12                     |
| Classification | Internal - do not forward                                  |

## Contents

1. The one rule
2. Who may say what
3. Status page rules
4. Templates
5. Support macros during an incident
6. Customer emails
7. Post-incident communication
8. Things we do not say

## 1. The one rule

**Nothing goes outside Beacon until Security has cleared it.** Not a status page post, not a tweet, not a "just so you know" to a friendly customer, not a reply in a ticket that says more than the holding line. This rule exists because the first version of what we know is usually wrong, and a wrong statement about customer data is worse than a slow one.

Clearing takes minutes when the comms owner has a draft ready. Have the draft ready.

## 2. Who may say what

| Role                        | May                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Incident lead               | Assign a comms owner. Approve internal updates. Not publish externally.                                                     |
| Comms owner                 | Draft status page posts and customer emails from the templates. Submit to Security for clearance. Publish once cleared.     |
| Security lead (or delegate) | Clear or edit external communications. Decide whether an incident involves data and therefore requires notification review. |
| Support                     | Use the holding macro (section 5). Nothing else until the status page is live, then link to it.                             |
| Account executives and CSMs | Link to the status page. Do not paraphrase it. Do not add detail from the incident channel.                                 |
| Anyone else                 | Nothing external. Point to the status page.                                                                                 |

For SEV-3 there is usually no external communication. The incident lead decides; if in doubt, ask Security.

## 3. Status page rules

1. Post within **30 minutes** of a SEV-1 declaration and within **60 minutes** of a SEV-2 that has customer-visible impact. A post that says "we are investigating" beats silence.
2. One component per affected thing: Email delivery, SMS delivery, Push delivery, In-app, API, Web app, Webhooks, Billing. Do not mark "All systems" unless all systems.
3. Use the four states in order: Investigating, Identified, Monitoring, Resolved. Do not skip Monitoring; a premature Resolved that gets reopened costs more trust than a slow one.
4. Update at the interval you promised. SEV-1: every 30 minutes. SEV-2: every hour. If there is nothing new, say there is nothing new and give the next time.
5. Facts only. What is affected, since when, what customers may see, what to do (usually nothing). No cause until Security clears it, and never a cause we have not confirmed.
6. Never name a vendor, provider, or carrier on the status page. "An upstream delivery provider" is the phrase.
7. Never mention data, credentials, or security on the status page without Security writing the sentence.
8. Resolved posts include the total duration and a line that a write-up will follow for SEV-1.

Publishing rights on the status page tool are limited to the comms owner pool and Security. If you are not in the pool and think you need to post, you need to page the comms owner, not request access.

## 4. Templates

Fill the brackets. Do not add sentences.

**Investigating**

> We are investigating [delayed delivery / elevated error rates / failures] affecting [component] for [some / a subset of / all] customers since approximately [HH:MM UTC]. Customers may see [what they see]. Messages are [queued and will be delivered when service is restored / not being accepted; retries are recommended]. Next update by [HH:MM UTC].

**Identified**

> We have identified the cause of [issue] affecting [component] and are working on a fix. [Any action customers should take, or "No action is required."] Next update by [HH:MM UTC].

**Monitoring**

> A fix has been applied for [issue] affecting [component]. We are monitoring delivery and error rates as [queued messages are released gradually / traffic returns to normal]. Next update by [HH:MM UTC].

**Resolved**

> This incident is resolved. [Component] was affected between [HH:MM] and [HH:MM UTC] ([duration]). [One sentence on customer-visible effect, e.g., "Email queued during this period has been delivered."] [SEV-1: "A post-incident summary will be published within five business days."]

## 5. Support macros during an incident

Until the status page is live, Support replies with the `incident-holding` macro:

> Thanks for reporting this. We are investigating a report affecting [component] and will update you as soon as we have more information.

Once the status page is live, Support switches to `incident-status-link`:

> We are aware of an issue affecting [component] and are actively working on it. Updates are being posted at [status page link]. We will follow up here when it is resolved.

Support does not: guess at cause, estimate resolution time beyond what the status page says, confirm or deny that data was involved, or discuss credits. Credits for outages are decided by Finance after the incident under the order form's service terms. The line is: "Once the incident is resolved, our team will review any service commitments in your agreement." Do not quote the refund policy in an incident context and do not quote any refund window; the 30-day customer-facing window is for billing errors and unused prepaid volume, not for outage credits, and the two get confused if you bring it up.

## 6. Customer emails

Direct customer emails go out only when the status page is not enough: the incident involved a specific customer's data, a specific customer's configuration needs to change, or a legal or contractual notification applies. Security decides. The comms owner drafts from the `incident-customer-notice` template; Security and Legal clear; the email goes from the incident mailbox, not from a personal address.

Recipients are workspace Admins. Not Editors, not the marketing contact, not the AE's favorite person. Admins.

If the incident involved data, Security also determines whether any regulatory or contractual notification obligation applies and its deadline. Follow local law; Security tracks the obligation and the clock. Nobody else sends anything.

## 7. Post-incident communication

SEV-1: a public post-incident summary within five business days of Resolved, drawn from the internal write-up, cleared by Security. It states what happened, the customer impact, what we changed, in plain language. It does not name vendors, staff, or customers.

SEV-2 with customer-visible impact: the Resolved status page post is usually sufficient. The incident lead and Security decide whether a summary is warranted.

Account teams may share the public summary with customers. They may not share the internal write-up.

## 8. Things we do not say

- "Human error." We say what the process failed to catch.
- "A small number of customers." We say the number, or we say "a subset" and give the number in the write-up.
- "No customer data was affected" before Security has confirmed it in writing.
- The name of any vendor, carrier, or provider.
- Any refund, credit, or compensation on the status page or in a ticket during the incident.
- "Resolved" before Monitoring has run at least 30 minutes clean.

**Done when** (comms, per incident): comms owner assigned; status page posted inside the window; updates on schedule; Support on the right macro; any customer email cleared by Security and Legal and sent to Admins; Resolved post with duration; SEV-1 summary published within five business days.
