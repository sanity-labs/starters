# Beacon Acceptable Use and Anti-Spam Policy

| Field          | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| Doc ID         | SEC-AUP-2025-11                                                                        |
| Version        | v1.4                                                                                   |
| Owner          | Security & Compliance                                                                  |
| Document owner | Priya Shah, Security Lead                                                              |
| Approved by    | General Counsel                                                                        |
| Last reviewed  | 2025-11-03                                                                             |
| Classification | Customer                                                                               |
| Related        | Deliverability Guide (CS-DEL-2026-02), SMS Sender Registration Primer (CS-SMS-2025-08) |

## 1. Why this policy exists

Beacon sends messages on behalf of thousands of workspaces through shared infrastructure. One customer's bad list can lower placement for everyone on the same sending path. This policy sets the floor. It protects your deliverability as much as it protects Beacon's.

The policy applies to every message sent through Beacon on any channel: email, SMS, push, and in-app. It applies to campaigns, workflows, and messages triggered through the Developer API. Your acceptance of the Beacon terms of service includes acceptance of this policy.

## 2. Consent

You may only message contacts who have given you permission to contact them on that channel.

**What counts as consent**

- A contact submitted a form on your property that clearly said they would receive messages from you.
- A contact completed a purchase or signup with you and the messages relate to that relationship.
- A contact texted a keyword to your registered SMS sender, or ticked an unchecked box that named SMS specifically.
- A contact enabled push notifications for your app.

**What does not count**

- A list you purchased, rented, traded, or received from a partner or event organizer.
- Addresses or numbers scraped from websites, directories, or social profiles.
- A pre-ticked box, a box hidden in terms text, or consent obtained for a different sender.
- Consent that is more than two years old with no message sent in between, unless you re-confirm it first.

Beacon stores a consent field on every contact. Map it when you import (Segments → Import) or set it through the API. Contacts without a consent status cannot be targeted by email campaigns. This is enforced in the product, not just in this document.

## 3. Prohibited practices

The following result in suspension. Beacon does not need to warn you first.

1. Sending to purchased, rented, or scraped lists.
2. Sending to contacts who have unsubscribed, replied STOP, or been suppressed.
3. Removing, hiding, or breaking the unsubscribe link or one-click unsubscribe header on email.
4. Using a From address, sender name, or reply-to that misrepresents who you are.
5. Deceptive subject lines, including "Re:" or "Fwd:" on a first-contact message, fake urgency about accounts the recipient does not have, and subject lines unrelated to the body.
6. Rotating domains, sender IDs, or content to evade filtering.
7. Sending on behalf of a third party who is not the workspace owner (no reselling of sending capacity without a written agreement with Beacon).
8. Using Beacon to send messages that are themselves the product, such as bulk cold outreach services.

## 4. Prohibited content

Beacon does not accept messages that:

- Promote or facilitate illegal activity in the sender's or recipient's jurisdiction.
- Contain malware, phishing content, or links to credential-harvesting pages.
- Promote high-risk categories that Beacon's carriers and mailbox partners do not accept, including unregulated lending, unlicensed gambling, and certain supplements. Contact Support before sending in a regulated category; some are permitted with sender registration.
- Contain sexually explicit material.
- Harass, threaten, or discriminate against recipients.

## 5. Rate and reputation thresholds

Beacon monitors every workspace continuously. The following triggers a review by the Deliverability team.

| Signal                                 | Review threshold    | Suspension threshold (sustained) |
| -------------------------------------- | ------------------- | -------------------------------- |
| Hard bounce rate                       | 2 percent of a send | 5 percent across 3 sends         |
| Complaint rate (email)                 | 0.1 percent         | 0.3 percent                      |
| Complaint rate (SMS)                   | 0.5 percent         | 1 percent                        |
| Spam trap hits                         | Any                 | Repeated after warning           |
| Blocklisting attributable to your list | Any                 | Second occurrence                |

Sustained means across three consecutive sends or seven days, whichever is shorter. Review means Beacon may pause sending while we ask you how the list was built. Suspension means sending stops on all channels until Security & Compliance clears the workspace.

These numbers are conservative on purpose. Mailbox providers act at similar levels, and once they act, Beacon cannot undo it for you.

## 6. Enforcement

**Review.** Deliverability contacts your workspace Admins with the campaign or workflow involved and asks for the source of the affected contacts. Sending may be paused on the affected channel during review. Most reviews close within two business days.

**Suspension.** Sending stops on all channels. Your data remains intact and you can still sign in, export, and edit. Security & Compliance decides whether the workspace can resume. Resumption usually requires removing the affected contacts, documenting the consent source for what remains, and re-warming.

**Termination.** Repeated violations, or a single violation involving prohibited content in section 4, end the account. Data export remains available for 30 days after termination.

Suspension is not a billing event. Plan fees continue during a suspension caused by a policy violation. See the Billing and Refund Policy for what is and is not refundable; message volume already delivered is never refundable, and a suspension does not create a refund on its own.

## 7. Reporting abuse

If you receive a message sent through Beacon that you believe violates this policy, forward it to abuse@beacon.example with full headers. Beacon investigates every report and does not disclose the reporter to the sender.

If your own domain or brand is being impersonated through Beacon, say so in the report. Impersonation reports are handled by Security & Compliance within one business day.

## 8. Your responsibilities

Compliance with the law is yours. Beacon provides the tools: consent fields, suppression lists, one-click unsubscribe, STOP handling, and sender registration support. Which laws apply depends on where you and your recipients are. Follow local law. When in doubt, obtain consent that would satisfy the strictest jurisdiction you send to.

Beacon may update this policy. Material changes are announced to workspace Admins by email at least 30 days before they take effect, except where a change is needed to respond to a carrier or provider requirement.

## Revision history

| Version | Date       | Change                                                                 |
| ------- | ---------- | ---------------------------------------------------------------------- |
| v1.2    | 2024-08-15 | Added SMS complaint thresholds                                         |
| v1.3    | 2025-04-22 | Added in-app to channel scope; clarified reselling                     |
| v1.4    | 2025-11-03 | Added enforcement stages; aligned thresholds with Deliverability Guide |
