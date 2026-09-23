# Beacon Campaign Analytics Glossary

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Doc ID         | CS-ANL-2025-10                                                                 |
| Version        | v2.0                                                                           |
| Owner          | Analytics                                                                      |
| Document owner | Analytics Product Team                                                         |
| Last reviewed  | 2025-10-08                                                                     |
| Classification | Customer                                                                       |
| Related        | Deliverability Guide (CS-DEL-2026-02), Data Retention by Plan (CS-RET-2026-01) |

## How to use this glossary

Every campaign and workflow report in Beacon uses the terms below. Each entry gives the definition Beacon uses, how the number is calculated, and the common ways it is misread. Where two teams at your company disagree about what "open rate" means, this document is the tiebreaker.

Metrics are grouped in the order a message moves: sent, delivered, engaged, converted. Rates are always expressed as a percentage of the step before, unless the entry says otherwise.

## Delivery metrics

**Sent.** The number of messages Beacon attempted to deliver. A contact in the target segment who was suppressed (unsubscribed, bounced previously, no consent) is not counted as sent. The campaign report shows suppressed contacts separately as **Skipped**.

**Delivered.** Messages accepted by the receiving mail server, carrier, or push platform. Delivery means acceptance, not inbox placement. A message can be delivered and land in a spam folder.

**Delivery rate.** Delivered divided by Sent. Healthy email campaigns run above 98 percent. Below 95 percent, look at the bounce breakdown before anything else.

**Hard bounce.** A permanent failure: the address does not exist, the domain has no mail server, or the recipient's server rejected the sender outright. Beacon suppresses hard-bounced addresses across the workspace.

**Soft bounce.** A temporary failure: full mailbox, server busy, message too large. Beacon retries soft bounces for up to 72 hours. If every retry fails, the message is recorded as a soft bounce in the final report.

**Blocked.** The receiving server rejected the message for reputation or content reasons. Blocked is reported separately from bounces because the fix is different: bounces are about the list; blocks are about the sender.

**Bounce rate.** Hard plus soft bounces divided by Sent. Above 2 percent on a single campaign warrants a look at where the contacts came from.

## Engagement metrics

**Open.** An email is counted as opened when the tracking pixel loads or when a click is recorded (a click implies an open). SMS and push do not have opens; push reports **Displayed** where the platform supports it.

**Open rate.** Unique opens divided by Delivered. Beacon reports unique opens by default. Total opens (the same contact opening three times) are available in the detail view.

Opens are an imperfect signal. Mail clients that pre-load images inflate opens; clients that block images suppress them. Treat open rate as a trend within your own audience, not as a number to compare against another company's. When open rate drops sharply while delivery rate holds steady, inbox placement has usually changed. See the Deliverability Guide.

**Click.** A recipient followed a tracked link in the message. Beacon rewrites links to track clicks unless you turn tracking off per link.

**Click rate.** Unique clicks divided by Delivered. This is the number most teams should optimize for on marketing sends.

**Click-to-open rate.** Unique clicks divided by unique opens. Measures how well the content performed among people who saw it, independent of placement and subject line.

**Reply.** SMS only. The recipient sent a message back to your sender. STOP and HELP replies are counted separately as **Opt-outs** and **Help requests**.

**Unsubscribe.** The recipient used the unsubscribe link, the one-click unsubscribe header, or replied STOP. Beacon suppresses the contact for that channel.

**Unsubscribe rate.** Unsubscribes divided by Delivered. Above 0.5 percent on a single send is high for an opted-in list. Consistently above that points to a cadence or relevance problem, not a copy problem.

**Complaint.** The recipient reported the message as spam through their mail provider, and the provider passed the report to Beacon through a feedback loop. Complaints are the single most damaging engagement event for your sending reputation. Beacon suppresses the contact.

**Complaint rate.** Complaints divided by Delivered. Keep this below 0.1 percent. The Acceptable Use Policy sets review and suspension thresholds on it.

## Conversion metrics

**Conversion goal.** An event you define per campaign or workflow that represents the outcome you wanted: a purchase, a signup, a form completion. Goals are defined in the campaign settings under **Goals** and can be a Beacon event, a custom event from the API, or a page view on a domain where the Beacon web snippet is installed.

**Conversion.** A contact who was delivered the message and then triggered the goal event within the **attribution window**.

**Attribution window.** How long after delivery a goal event counts as a conversion. The default is 7 days. You can set 1, 3, 7, 14, or 30 days per campaign. Longer windows attribute more conversions to the message and more of them are coincidental.

**Conversion rate.** Conversions divided by Delivered. Beacon also shows conversions divided by Clicked in the detail view.

**Attribution model.** When a contact received several messages before converting, Beacon attributes the conversion to the most recent message delivered within its window (last touch). Every message in the window is shown as **Assisted** in its own report. Assisted conversions are not summed across campaigns, so totals on the Analytics overview are never double counted.

**Revenue.** If your goal event carries a value property, Beacon sums it as revenue attributed to the campaign. Beacon does not convert currencies; send values in one currency.

## Comparison and benchmark metrics

**Rolling 30-day average.** On every campaign report, Beacon shows each rate next to the average for your workspace's campaigns on the same channel over the previous 30 days. This is your benchmark. Beacon does not publish cross-customer benchmarks, because audience, industry, and consent practices vary too much for them to mean anything.

**A/B test.** A campaign sent as two or more variants to random slices of the audience. The report shows each variant's rates with a confidence indicator. Beacon marks a winner when the difference in the chosen metric reaches 95 percent confidence. Below that, the report says **No clear winner**, and it means it.

**Cohort compare.** Available with Analytics. Compare any two segments' engagement across a date range. Useful for seeing whether a new acquisition source engages differently from the rest of the audience.

## Workflow-specific metrics

**Enrolled.** Contacts who entered the workflow through its trigger. A contact can be enrolled once at a time; re-enrollment rules are set per workflow.

**Active.** Contacts currently between steps, including contacts waiting in a delay step. Contacts in a paused workflow remain Active and count toward your included audience. See Workflow Pause and Restart (CS-WF-2026-04).

**Completed.** Contacts who reached an end step.

**Exited.** Contacts removed before completion by an exit condition, an unsubscribe, or a manual removal.

**Step conversion.** For each message step, the same delivery and engagement metrics as a campaign, computed over contacts who reached that step.

## Reading a report in order

When a campaign underperforms, read the metrics in the order the message moved and stop at the first one that looks wrong.

1. Sent much lower than the segment size: suppression or consent. Check Skipped.
2. Delivery rate low: list quality. Check bounces and blocks.
3. Open rate low with normal delivery: placement or subject line. Check authentication first, subject line second.
4. Click rate low with normal opens: content and offer.
5. Conversion rate low with normal clicks: landing page or goal definition.

Skipping to step 4 when the problem is at step 2 is the most common analytics mistake we see, and it leads teams to rewrite content when the fix is a DNS record.

## Export

Every report exports to CSV from the **Export** action. Analytics customers can also pull the same metrics through the Developer API. Contact-level event detail is subject to your plan's retention period; aggregate counts are kept indefinitely. See Data Retention by Plan (CS-RET-2026-01).

## Revision history

| Version | Date       | Change                                                               |
| ------- | ---------- | -------------------------------------------------------------------- |
| v1.0    | 2024-04-11 | Initial glossary                                                     |
| v1.1    | 2025-02-03 | Added workflow metrics                                               |
| v2.0    | 2025-10-08 | Added attribution model, cohort compare, "reading a report in order" |
