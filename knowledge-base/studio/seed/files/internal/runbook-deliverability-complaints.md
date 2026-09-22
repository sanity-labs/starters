# Runbook: Deliverability Complaint Handling

| Field          | Value                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Doc ID         | OPS-DEL-2026-03                                                                                |
| Version        | v2.1                                                                                           |
| Owner          | Customer Success                                                                               |
| Document owner | Marcus Lindqvist, Deliverability Lead                                                          |
| Last reviewed  | 2026-03-17                                                                                     |
| Classification | Internal - do not forward                                                                      |
| Related        | Deliverability Guide (CS-DEL-2026-02), Acceptable Use Policy (SEC-AUP-2025-11), On-Call Roster |

## Purpose

Two kinds of tickets land here. A customer says "our email is going to spam" (inbound complaint about placement). Or a mailbox provider, carrier, or recipient says "your customer is spamming us" (external complaint about a customer). Both follow this runbook. They have different first steps and the same underlying checklist.

## When to use

- Ticket tagged `deliverability`.
- Abuse report to abuse@ naming a workspace.
- Blocklist notification, or an A-rotation on-call page handed to CS in the morning.
- Complaint rate alert from the monitoring dashboard (email above 0.1 percent, SMS above 0.5 percent).

## Part A: Customer says placement dropped

### 1. Get the facts before theories

Ask for, or pull yourself: campaign ID(s), when the drop started, which provider(s) the customer noticed it on, and whether anything changed on their side (new domain, new template, new list, new DNS host, website migration).

Pull the campaign report. Note delivery rate, open rate, bounce breakdown, complaint rate, and the rolling 30-day comparison.

### 2. Authentication first

Open the workspace's Channels → Email → Authentication in the admin tool.

- Any record not Verified: that is the answer. Send the Domain Authentication Checklist (CS-DNS-2026-05) with the specific failing record named. Half of these tickets end here.
- All Verified: check the DMARC pass rate on the same page. Below 95 percent means alignment drift, usually a new From address on a different domain.
- Check the verification history. A record that dropped for two days and came back explains a two-day dip.

### 3. Reputation second

- Complaint rate on the affected sends. Above 0.1 percent: ask how the affected contacts were acquired. Look at the segment definition; a "re-engagement" segment of contacts inactive for two years is a complaint generator.
- Bounce rate. Above 2 percent hard bounces: stale list. Ask when it was last cleaned and where it came from.
- Volume pattern. A jump from 5,000 a week to 50,000 in a day on a domain under six months old is a warming problem, whatever the customer calls it.
- Blocklists. Check the workspace's sending domain against the standard blocklist lookup in the admin tool. A listing points to list quality, not content.

### 4. Content third

Only after 2 and 3 are clean. Look at the template: image-only body, public link shorteners, a From name that changed, a reply-to that bounces. Suggest fixes from the Deliverability Guide, section 5.

### 5. Respond

Tell the customer what you found in the order you checked it. Be specific: "DKIM record beacon2 stopped resolving on the 3rd" beats "authentication issue." Link the relevant customer document. Set expectations: authentication fixes show within a day; reputation recovery takes two to four weeks of clean sending.

Do not promise inbox placement. Do not offer credits for placement; placement is not a billing event and delivered volume is not refundable. If the customer pushes on billing, hand to the Billing Disputes runbook.

## Part B: External complaint about a customer

### 1. Acknowledge and identify

Acknowledge the reporter within one business day (impersonation reports: same day, and Security & Compliance takes over). Identify the workspace from the message headers or the tracking domain. Record the workspace ID in the ticket.

### 2. Assess

Pull the workspace's last 30 days: complaint rate, bounce rate, spam trap hits, blocklistings, volume trend, and account age. Check the consent source on the affected segment: import history, form source, API.

| Finding                                                                                                   | Action                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Complaint rate below thresholds, isolated report, consent source documented                               | Log the report. Reply to reporter. Notify the customer as a courtesy. Done.                                                                  |
| Complaint rate above review threshold, or spam trap hit, or consent source unclear                        | **Review.** Pause the affected channel. Notify the customer's Admins with the campaign and the question: where did these contacts come from? |
| Purchased or scraped list confirmed, or blocklisting attributable to the workspace, or prohibited content | **Suspension.** Pause all channels. Escalate to Security & Compliance. Customer notification comes from Security, not from you.              |

Thresholds are in the Acceptable Use Policy, section 5. Apply them as written. Do not negotiate them on a call.

### 3. Pausing

Admin tool: workspace → Sending → Pause channel (or Pause all). Enter the ticket ID as the reason. Pausing is reversible and logged. It stops new sends; messages already handed to providers complete.

A paused workspace still bills its plan fee. Do not adjust billing. If the customer asks, the Acceptable Use Policy is explicit that suspension is not a billing event.

### 4. Review conversation

Ask the customer's Admins, in writing:

1. Where did the contacts in campaign X come from?
2. When and how did they consent?
3. Can you show us the form or the keyword prompt?

Documented consent from their own property: remove any clearly bad segment, require a re-warm, resume the channel. Log the outcome.

Purchased list, partner list, scraped, or "we have always had them": do not resume. Escalate to Security & Compliance for a suspension decision. Tell the customer that Security & Compliance will contact them. Do not debate the policy.

### 5. Resume

Resume only after the affected contacts are removed and the customer has acknowledged the consent requirement in writing on the ticket. Resume one channel at a time. Require a warming segment for the first week and check the complaint rate after the first send.

## Escalation

- Impersonation of a real brand or person: Security & Compliance, same day.
- Prohibited content (Acceptable Use Policy section 4): Security & Compliance, same day, pause all channels first.
- Blocklisting of shared infrastructure (not just the customer's domain): A-rotation on-call. That is an incident.
- Customer disputes a pause and escalates to their account executive: loop in the AE, do not lift the pause.
- Customer asks about refunds during a pause: Billing Disputes runbook. The answer is almost always no; suspension is not a billing event and delivered volume is not refundable.

## Done when

**Part A:** authentication, reputation, and content checked in that order; findings and evidence in the ticket; customer told what was found and what to fix, with the relevant document linked.

**Part B:** reporter acknowledged; workspace identified; assessment recorded against the thresholds; pause applied if warranted, with ticket ID; consent conversation documented; resume or escalate recorded with the reason.

## Revision history

| Version | Date       | Change                                                              |
| ------- | ---------- | ------------------------------------------------------------------- |
| v2.0    | 2025-09-02 | Split into Part A and Part B                                        |
| v2.1    | 2026-03-17 | Aligned thresholds with SEC-AUP-2025-11 v1.4; added resume criteria |
