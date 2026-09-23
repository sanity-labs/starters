# Beacon Data Retention by Plan

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Doc ID         | CS-RET-2026-01                                                      |
| Version        | v1.3                                                                |
| Owner          | Security & Compliance                                               |
| Document owner | Priya Shah, Security Lead                                           |
| Last reviewed  | 2026-01-27                                                          |
| Classification | Customer                                                            |
| Related        | Workspace Data Requests (CS-DSR-2026-03), Billing and Refund Policy |

## Overview

Beacon stores three kinds of data for your workspace, and each has its own retention rule.

**Contact data** is the audience itself: contacts, attributes, consent status, and segment membership. Beacon keeps it as long as your workspace is active. You control it; delete a contact and it is gone.

**Event data** is what happened: sends, deliveries, opens, clicks, bounces, complaints, custom events from the API, and workflow step completions. This is the data with a plan-based retention period, because it grows without limit and it is what powers Analytics.

**Content and configuration** is what you built: campaigns, templates, workflows, segments, API keys, members. Beacon keeps it as long as the workspace is active.

This document explains the event data retention schedule, how to shorten it, what happens to data when you downgrade or cancel, and how retention interacts with exports.

## Event data retention schedule

| Plan tier  | Products                       | Default event retention | Configurable                    |
| ---------- | ------------------------------ | ----------------------- | ------------------------------- |
| Starter    | Segments                       | 90 days                 | Shorter only                    |
| Growth     | Campaigns, Workflows, Channels | 13 months               | Shorter only                    |
| Enterprise | Analytics, Developer API       | 25 months               | Shorter, or longer by agreement |

Your workspace's retention period is set by the highest tier among the products enabled on it. A workspace with Segments and Campaigns retains for 13 months. Adding Analytics extends retention to 25 months for all event data, including events that were already stored.

Thirteen months rather than twelve so that a year-over-year comparison in Analytics always has a full month of overlap. Twenty-five months for the same reason at two years.

Retention is measured from the event timestamp. An open recorded on 2025-03-01 in a Growth workspace becomes eligible for deletion on 2026-04-01. Deletion runs nightly and is permanent.

## Aggregate reporting

When raw events expire, Beacon keeps daily aggregate counts per campaign and per workflow step indefinitely: sends, deliveries, opens, clicks, bounces, complaints, unsubscribes, and conversions. That means a campaign report from three years ago still shows its totals. What you lose is the contact-level detail: which contact opened, when, on what device.

Aggregate counts cannot be used to rebuild a segment. If "clicked in the last 18 months" is a segment you need, you need a retention period that covers 18 months.

## Shortening retention

Admins can set a shorter retention period than the plan default in Administration → Data → Retention. Choose any period from 30 days up to the plan maximum.

Reasons customers do this:

- A privacy commitment to their own users that limits how long behavioral data is kept.
- A contractual requirement from their own customers.
- Reducing the footprint of data subject to a data request.

Shortening retention deletes events older than the new period on the next nightly run. Beacon shows a count of affected events and asks for confirmation. There is no undo. Aggregate counts are kept regardless.

Retention settings apply to the whole workspace. Beacon does not support different retention periods for different channels or campaigns.

## Downgrades

When a downgrade reduces your retention period, Beacon applies the new period at the renewal date when the downgrade takes effect, not at the moment you request it. Events older than the new period are deleted on the first nightly run after renewal.

Example: a workspace with Analytics (25 months) removes Analytics and keeps Campaigns (13 months). At the next renewal, events between 13 and 25 months old are deleted. Beacon emails Admins 14 days and 3 days before a downgrade that will delete data, with the count of affected events and a link to export them.

Export before the renewal date if you need the detail. See "Exports and retention" below.

## Cancellation

When you cancel, your plan remains active until the end of the paid period. Retention continues as normal until then.

After the paid period ends, the workspace enters a 90-day dormant state. You can sign in, export, and reactivate. You cannot send. Event data is not deleted during the dormant state, and the retention schedule pauses, so nothing ages out while you decide.

At the end of the 90 days, Beacon deletes the workspace: contacts, events, content, configuration, and aggregates. Beacon sends a reminder to Admins 30 days and 7 days before deletion. Deletion is permanent and Beacon cannot restore a deleted workspace from backup.

If you reactivate within the 90 days, retention resumes and the paused period does not count against any event's age.

## Suspension

A workspace suspended under the Acceptable Use Policy keeps all data. Retention continues on the normal schedule. Suspension does not shorten or extend anything.

## Exports and retention

Admins can export event data at any time from Administration → Data → Export. An export includes every event within the current retention period; events already deleted cannot be exported. Large exports are delivered as a downloadable archive with a link that expires after seven days.

Exporting does not reset or extend retention. If you export in month 12 of a 13-month period, the events are still deleted in month 13.

Analytics customers can also pull events continuously through the Developer API, which is the right approach when you want to keep more history than your plan retains: stream events to your own warehouse as they happen. See the API Quickstart and Webhooks guide (DEV-API-2026-06).

## Backups

Beacon keeps encrypted backups for disaster recovery for 35 days. Backups are used to restore the platform, not individual workspaces or contacts, and they are not accessible to customers. Data deleted by retention or by a deletion request is removed from backups as they cycle out, within 35 days.

## Legal holds

If Beacon is required to preserve a workspace's data by law or court order, retention and deletion are paused for that workspace until the hold is lifted. Beacon notifies Admins where it is permitted to. Legal holds are handled by Security & Compliance.

## Summary table

| Event                         | What happens to event data                               |
| ----------------------------- | -------------------------------------------------------- |
| Normal operation              | Deleted nightly once older than the plan period          |
| Retention shortened by Admin  | Deleted on next nightly run                              |
| Upgrade                       | Period extends, including already-stored events          |
| Downgrade                     | Period shortens at renewal; excess deleted after renewal |
| Cancellation, paid period     | No change                                                |
| Cancellation, dormant 90 days | Retention paused; nothing deleted                        |
| End of dormant period         | Whole workspace deleted                                  |
| Suspension                    | No change                                                |
| Legal hold                    | Retention paused                                         |

## Revision history

| Version | Date       | Change                                          |
| ------- | ---------- | ----------------------------------------------- |
| v1.1    | 2024-10-02 | Added dormant state                             |
| v1.2    | 2025-07-15 | Added aggregate reporting section               |
| v1.3    | 2026-01-27 | Clarified downgrade timing; added summary table |
