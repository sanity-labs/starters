# Beacon Deliverability Guide

| Field          | Value                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------- |
| Doc ID         | CS-DEL-2026-02                                                                            |
| Version        | v3.0                                                                                      |
| Owner          | Deliverability                                                                            |
| Document owner | Marcus Lindqvist, Deliverability Lead                                                     |
| Last reviewed  | 2026-02-09                                                                                |
| Classification | Customer                                                                                  |
| Related        | Domain Authentication Checklist (CS-DNS-2026-05), Acceptable Use Policy (SEC-AUP-2025-11) |

## Who this is for

You run email, SMS, or push through Beacon and you want messages to land where the recipient expects them: the inbox, the phone, the lock screen. This guide explains what affects that outcome, which parts are yours to control, and what Beacon does on your behalf.

Most of this guide is about email, because email is where reputation is hardest to earn and easiest to lose. The SMS and push sections at the end cover what is different about those channels.

## The short version

1. Authenticate your sending domain before you send anything to real contacts.
2. Warm a new domain or a new IP gradually.
3. Send only to people who asked to hear from you, and stop when they ask you to.
4. Read the delivery log before you change the subject line.

If you do those four things, most deliverability problems never happen. If you skip one, no amount of copywriting will fix it.

## 1. Authentication

Mailbox providers decide whether to trust a message before they read it. They check whether the domain in the From address has authorized the server that sent the message. Beacon supports the three standard mechanisms.

**SPF** publishes which servers may send mail for your domain. Beacon gives you an include record to add.

**DKIM** signs each message with a key tied to your domain. Beacon generates two CNAME records that point to rotating keys we manage.

**DMARC** tells providers what to do when SPF or DKIM fail and where to send reports. Beacon recommends starting at `p=none` while you confirm alignment, then moving to `p=quarantine`.

You add these records in Channels → Email → Authentication. Beacon shows each record, checks DNS every few minutes, and marks the domain **Authenticated** when all three resolve. The full walkthrough, including what to do at common DNS hosts, is in the Domain Authentication Checklist (CS-DNS-2026-05).

Until your domain is authenticated, Beacon sends from a shared Beacon subdomain. That is fine for testing. It is not fine for production, because you inherit the reputation of everyone else on the shared domain and you cannot build your own.

**Incomplete authentication is the most common cause of spam placement we see.** When a customer opens a ticket that says "our emails suddenly go to spam," the first thing Support checks is whether one of the three records changed or expired. Roughly half the time, that is the whole story.

## 2. Warming

A domain or IP with no sending history has no reputation. Mailbox providers treat a sudden burst from an unknown sender the way a bank treats a sudden burst of transactions from a new card: as a possible takeover.

Warming means increasing volume gradually so providers can watch how recipients react. Beacon's guidance:

| Week     | Daily volume     | Audience                                                           |
| -------- | ---------------- | ------------------------------------------------------------------ |
| 1        | Up to 500        | Your most engaged contacts (opened or clicked in the last 30 days) |
| 2        | Up to 2,000      | Engaged in the last 60 days                                        |
| 3        | Up to 10,000     | Engaged in the last 90 days                                        |
| 4 onward | Double each week | Full opted-in audience                                             |

These numbers are a starting point, not a rule. If bounce or complaint rates rise during a step, hold at that volume for a few more days. If you are moving an existing list from another provider, warm anyway. Your list has history; your new domain and Beacon's sending path do not.

Build the warming audience as a Segment with a last-engaged filter. Campaigns can then target that Segment directly, and you can widen the filter each week without rebuilding anything.

## 3. Consent

Beacon requires that every contact you message has opted in. That is a platform rule, not a suggestion. The Acceptable Use Policy (SEC-AUP-2025-11) spells out the consequences.

In practice:

- Import a consent status with every contact. Segments → Import lets you map a column to the consent field. Contacts without consent can be stored but cannot be targeted by email campaigns.
- Do not buy, rent, or scrape lists. A purchased list has no consent to Beacon, and its bounce and complaint rates will damage your domain within a single send.
- Honor unsubscribes on the next send. Beacon adds a one-click unsubscribe header and a footer link to every email campaign and suppresses unsubscribed contacts automatically. Removing the link is not supported.
- Re-permission old contacts before you message them. If a contact has not heard from you in more than a year, send a short reconfirmation to a small slice first and watch the complaint rate.

Consent is also the difference between a soft deliverability problem and a hard one. Low engagement can be recovered. A spam-trap hit or a blocklisting from a purchased list can take months to clear, and Beacon cannot appeal on your behalf.

## 4. Bounces and rejections

Every email Beacon sends produces a delivery event. Read them in Channels → Delivery log, or per campaign in the campaign report.

| Event        | Meaning                                                     | What to do                                                       |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Delivered    | Accepted by the receiving server                            | Nothing. This does not guarantee inbox placement.                |
| Hard bounce  | Address does not exist or domain rejects permanently        | Beacon suppresses the address. Do not re-add it.                 |
| Soft bounce  | Temporary failure: full mailbox, server busy, greylisting   | Beacon retries for up to 72 hours, then records a bounce.        |
| Blocked      | Receiving server rejected for reputation or content reasons | Read the reason string. Check authentication and complaint rate. |
| Complaint    | Recipient marked the message as spam                        | Beacon suppresses the address. Review how they were acquired.    |
| Unsubscribed | Recipient used the unsubscribe link or header               | Beacon suppresses the address.                                   |

Two thresholds to watch across any campaign: hard bounces above 2 percent suggest a stale list, and complaints above 0.1 percent suggest a consent problem. Either one, sustained, will move you toward the spam folder no matter how good the content is.

Delivered and inbox are not the same thing. Beacon can confirm that a server accepted the message. Where the server filed it is up to the provider. Open and click rates in Analytics are the best signal you have of placement. A sudden drop in opens with steady delivery rates almost always means placement changed.

## 5. Content and sending patterns

Content matters less than people think and more than zero. Providers do look at it, but mostly as a tiebreaker once reputation is established.

- Keep a consistent From name and address. Changing it resets recognition.
- Use a real reply-to address that someone reads.
- Balance text and images. An image-only email with one link looks like a phishing template.
- Avoid link shorteners and tracking domains that are not yours. Beacon can brand tracking links under your domain; ask Support to enable it.
- Send on a predictable cadence. Providers learn your pattern. A weekly sender who suddenly sends daily looks compromised.
- Preview before you send. Campaigns → New campaign → Preview sends a test to your own inbox and shows the rendered message on common clients.

## 6. What Beacon does for you

- Manages DKIM key rotation once your CNAME records are in place.
- Retries soft bounces and suppresses hard bounces, complaints, and unsubscribes across your whole workspace.
- Maintains feedback loops with major mailbox providers so complaints reach your delivery log.
- Monitors shared infrastructure reputation and moves affected sending paths.
- Enforces one-click unsubscribe on every email campaign.

## 7. What Beacon does not do

- Beacon does not appeal blocklistings that result from purchased lists or scraped data.
- Beacon does not guarantee inbox placement. No provider can.
- Beacon does not edit your DNS. You or your DNS host adds the records.
- Beacon does not remove suppressed contacts on request. If a contact wants to hear from you again, they resubscribe through your own form.
- Beacon does not send on your behalf to contacts who lack a consent status.

## 8. SMS

SMS deliverability is governed by carriers rather than mailbox providers, and the rules are stricter. In most markets you register a sender identity before you can send at volume, and unregistered traffic is filtered aggressively. The SMS Sender Registration Primer (CS-SMS-2025-08) covers that process.

Consent rules for SMS are also stricter. Keep a record of when and how each contact opted in. Include your brand name in every message. Honor STOP replies immediately; Beacon processes them automatically and suppresses the number.

SMS is available on Growth and Enterprise products that list it as a channel. Check your product list in Administration → Billing if you are not sure.

## 9. Push

Push notifications depend on a valid device token and current platform credentials. Upload your APNs key and FCM credentials in Channels → Push. Expired credentials are the most common push failure and show as a credential error in the delivery log, not as a bounce.

Device tokens expire when a user uninstalls or resets the app. Beacon marks those tokens inactive after the platform reports them and stops sending to them. Do not re-import inactive tokens from a backup.

## 10. When to contact Support

Open a ticket when you see any of the following: a domain that stays at **Pending** for more than an hour after you added records; a block reason string you do not understand; a complaint rate above 0.1 percent that you cannot explain; or a sudden drop in open rate with no change on your side.

Include the campaign ID and a sample of the delivery log. Support reviews authentication first, then reputation, then content. Expect that order.

## Revision history

| Version | Date       | Change                                                                    |
| ------- | ---------- | ------------------------------------------------------------------------- |
| v2.0    | 2024-09-30 | Added SMS and push sections                                               |
| v2.1    | 2025-06-12 | Updated warming table; added one-click unsubscribe note                   |
| v3.0    | 2026-02-09 | Rewrite; added "what Beacon does not do"; linked authentication checklist |
