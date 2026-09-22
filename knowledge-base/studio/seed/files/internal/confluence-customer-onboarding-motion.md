# New Customer Onboarding Motion (First 30 Days)

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Space          | Customer Success / Playbooks                       |
| Page ID        | 51120388                                           |
| Labels         | onboarding, customer-success, activation, playbook |
| Page owner     | Customer Success Leadership                        |
| Last updated   | 2026-06-03 by CS Ops                               |
| Exported       | Exported from Confluence on 2026-08-20             |
| Classification | Internal - do not forward                          |

## Contents

1. Goal
2. The three milestones
3. Day-by-day
4. Plan-specific notes
5. Red flags
6. Handoff to steady state
7. Known documentation gaps

## 1. Goal

A customer who authenticates a domain, sends a real campaign, and turns on a real workflow in the first 30 days renews. A customer who does none of those churns at renewal at four times the rate. The onboarding motion exists to get every new workspace past those three milestones, in that order, inside 30 days.

Activation is not "logged in." It is not "imported contacts." It is a message delivered to real people from the customer's own domain.

## 2. The three milestones

| Milestone      | Definition                                                              | Target day | Owner                                    |
| -------------- | ----------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| Authenticated  | Sending domain shows Authenticated in Channels → Email → Authentication | Day 5      | CSM, with Support for DNS questions      |
| First campaign | A campaign sent to more than 100 contacts from the authenticated domain | Day 14     | CSM                                      |
| First workflow | A workflow live with an event trigger and at least one enrolled contact | Day 30     | CSM, with SE for API-triggered workflows |

Track each in the CS tool. The activation dashboard reads these directly from workspace data; do not mark them by hand.

## 3. Day-by-day

**Day 0: kickoff.** 45 minutes. Attendees: their Admin, their marketing lead, whoever owns DNS. Agenda: what they are sending, to whom, from which domain, and who does DNS. Leave with the DNS owner's name. If nobody in the room owns DNS, the kickoff has not finished.

Send the Domain Authentication Checklist (CS-DNS-2026-05) the same day, addressed to the DNS owner by name.

**Day 1 to 5: authentication.** Check the Authentication page daily. Pending past 24 hours: message the DNS owner directly with the specific record that is not resolving. Do not wait for them to notice. Half of onboarding delays are a DNS ticket sitting in someone's IT queue.

Parallel: they import contacts. Confirm the consent column is mapped. An import without consent produces an empty campaign audience on day 10 and a confused customer.

**Day 5: authenticated.** If not, escalate internally to Support for a DNS review and externally to the exec sponsor. Do not start campaign planning on an unauthenticated domain; the first campaign from the shared subdomain teaches them the wrong habits.

**Day 6 to 14: first campaign.** Help them build a warming segment (engaged in last 30 days) and send their first real campaign to it. Small is fine. Real is required. Walk them through the report afterward using the Campaign Analytics Glossary (CS-ANL-2025-10), especially the "reading a report in order" section.

**Day 15 to 30: first workflow.** Pick the simplest workflow that matters to them: welcome series on signup, or a post-purchase follow-up. If the trigger is an event from their product, loop in an SE and send the API Quickstart (DEV-API-2026-06). Goal is one live workflow with real enrollments by day 30, not a beautiful ten-step journey.

**Day 30: review.** 30 minutes. Show them their own numbers against their own first-week baseline. Confirm the three milestones. Book the 90-day check-in. Hand to steady state.

## 4. Plan-specific notes

**Segments only (Starter).** Email only. Authentication and a first campaign are the whole activation; there is no workflow milestone unless they add Workflows. Do not sell Workflows in onboarding; note the interest for the 90-day call.

**Campaigns or Channels (Growth).** Full motion. SMS customers additionally need sender registration, which takes one to three business days per stage and should start on day 0. Send the SMS Sender Registration Primer (CS-SMS-2025-08) with the caveat in section 7 below.

**Workflows (Growth).** The workflow milestone is the one that matters. Aim for it by day 21, not day 30.

**Analytics or Developer API (Enterprise).** Assign an SE at kickoff. API customers usually activate through the integration rather than the UI; the first campaign milestone can be satisfied by a transactional template sent via API to more than 100 contacts.

## 5. Red flags

- No DNS owner identified at kickoff.
- Contacts imported without a consent column.
- Customer asks to import a list they bought or received from a partner. Stop. Explain the Acceptable Use Policy (SEC-AUP-2025-11). If they proceed anyway, flag Deliverability before the send, not after.
- Admin seat is held by a contractor or agency, not an employee. Get an employee Admin added before day 14.
- Customer wants to send to their full list on day 1 from a new domain. Warming conversation. See the Deliverability Guide (CS-DEL-2026-02).
- Billing questions in the first week that reference a refund window. Answer from the help article "Refunds and credits": 30 days from invoice date. Do not forward the Finance PDF; see section 7.

## 6. Handoff to steady state

At day 30 the CSM posts a handoff note in the account record: milestones hit and dates, open risks, integrations in place, named contacts and their roles, and any product feedback worth routing. The account moves to the steady-state cadence (quarterly check-ins, usage-drop alerts per the Churn-Save Play).

## 7. Known documentation gaps

Keep this list current. Customers find these documents in search and we get asked about them.

- **SMS Sender Registration Primer (CS-SMS-2025-08), section "Plan availability."** Says SMS is available on Segments (Starter) with an add-on. It is not. Segments is email only and there is no SMS add-on. The primer was last reviewed in 2024 and Channels owns the fix. Until it is updated, send the primer for the registration steps and tell SMS-curious Starter customers that SMS requires Campaigns, Channels, Workflows, or the Developer API.
- **Billing and Refund Policy PDF (FIN-REF-2025-03).** States a 45-day window from charge date. Outdated. Current policy is 30 days from invoice date, per the help article and the refund policy in Studio. Do not send the PDF. Finance is removing it from the customer share.
- **Data retention.** The help article "Data retention and exports" is still in draft. Use the Data Retention by Plan PDF (CS-RET-2026-01), which is current.
