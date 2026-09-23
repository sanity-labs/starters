# Beacon Workflow Pause and Restart Guide

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Doc ID         | CS-WF-2026-04                                                           |
| Version        | v1.2                                                                    |
| Owner          | Workflows                                                               |
| Document owner | Workflows Product Team                                                  |
| Last reviewed  | 2026-04-14                                                              |
| Classification | Customer                                                                |
| Related        | Campaign Analytics Glossary (CS-ANL-2025-10), Billing and Refund Policy |

## Three actions that look alike

A workflow has three controls that stop or change how contacts move through it: **Pause**, **Resume**, and **Restart**. They are easy to confuse and the differences matter for both your audience and your bill. This guide explains what each does, what happens to contacts already inside the workflow, and how each one affects usage.

Campaigns have a simpler version of the same story, covered at the end.

## Pause

Pausing a workflow freezes it. Contacts inside the workflow stay exactly where they are: a contact waiting in a two-day delay stays in the delay, a contact about to receive the third email does not receive it. No new contacts are enrolled while the workflow is paused, even if they trigger the entry event.

**When to pause**

- You found an error in a message and need to fix it before more contacts reach that step.
- A downstream system (your store, your support tool) is down and the messages would send people somewhere broken.
- You are changing the audience rules and want to prevent enrollments while you edit.

**What happens to the audience**

Enrolled contacts remain enrolled. They show as **Active** in the workflow report for the whole time the workflow is paused, and they still count toward your workspace's included audience during that period. Beacon does this so that when you resume, everyone continues from where they left off. If you would rather those contacts leave the workflow, use **Exit all** before pausing.

**What happens to billing**

Messages the pause prevented are not billed. Beacon meters message volume at delivery; a message that never sent never counts. The enrolled contacts count toward audience as described above. There is no other billing effect. A pause does not stop your plan fee, and it does not trigger any refund.

**Delays while paused**

Time keeps passing for delay steps while the workflow is paused. A contact who entered a three-day delay one day before the pause, and is resumed a week later, has already satisfied the delay and moves on immediately at resume. If you want to prevent a burst of catch-up sends at resume, read "Resume" below.

**How to pause**

Open the workflow and choose **Pause** from the status control at the top right. Beacon shows the count of Active contacts and asks you to confirm. Pausing takes effect within a few seconds. Messages that were already handed to a carrier or mail server complete; Beacon does not recall them.

Editors and Admins can pause. Viewers cannot.

## Resume

Resuming a paused workflow lets every Active contact continue from the last step they completed. Enrollment reopens for new contacts.

**Catch-up behavior**

Contacts whose delays expired while the workflow was paused are eligible to move immediately. If the pause was long, that can mean a large batch of messages in the first minutes after resume. Beacon offers two options on the Resume dialog.

| Option      | Behavior                                                     |
| ----------- | ------------------------------------------------------------ |
| Send now    | All eligible contacts move on immediately                    |
| Spread over | Eligible contacts are released evenly over 1, 4, or 24 hours |

Spread over is the safer choice after a pause longer than a day. It protects your deliverability (a sudden spike from a normally steady sender looks suspicious) and it protects your recipients from receiving three messages in one afternoon that were designed to be a week apart.

**Skipping missed steps**

Resume also offers **Skip time-sensitive steps**. When enabled, any message step tagged as time-sensitive in its settings is skipped for contacts who would have received it during the pause. Use this for messages like "your trial ends tomorrow" that make no sense two weeks late.

**Billing**

Messages sent after resume are billed normally. Nothing is charged for the paused period.

## Restart

Restart is a different action from Resume. Restart sends every currently enrolled contact back to the first step of the workflow and re-enrolls contacts who previously completed or exited, if the workflow's re-enrollment rules allow it.

**When to restart**

Rarely. Restart is intended for workflows that were misconfigured from the first step, where the right outcome is for everyone to experience the corrected version from the beginning. If only one step was wrong, fix that step and resume instead.

**What happens to the audience**

All Active contacts move to step one. Completed and Exited contacts are re-enrolled only if the workflow allows re-enrollment, which is off by default. Contacts who unsubscribed remain suppressed and are not re-enrolled under any setting.

**What happens to billing**

Restart may re-bill message volume. A contact who received steps one through three, and is restarted, will receive steps one through three again, and each of those deliveries is metered. Beacon shows an estimate of the resulting message volume on the Restart dialog. That estimate is the number to look at before you confirm.

Messages already delivered before the restart are not refundable. They were delivered.

**Who can restart**

Admins only. Restart is listed under the workflow's **More** menu rather than on the main status control, and it requires you to type the workflow name to confirm.

## Summary

| Action  | Enrolled contacts                 | New enrollments         | Unsent messages billed | Previously sent messages | Audience count |
| ------- | --------------------------------- | ----------------------- | ---------------------- | ------------------------ | -------------- |
| Pause   | Stay in place                     | Blocked                 | No                     | Unchanged                | Still counted  |
| Resume  | Continue from last completed step | Reopened                | When sent              | Unchanged                | Counted        |
| Restart | Return to step one                | Per re-enrollment rules | When sent              | Not refunded; may repeat | Counted        |

## Pausing a campaign

Campaigns are one-time sends, so the controls are simpler. A scheduled campaign can be paused before or during the send. Pausing stops the remaining send. Contacts already delivered stay in reporting and are billed. Contacts not yet sent are not billed for that send.

A paused campaign can be resumed, which sends to the remaining contacts, or cancelled, which ends it. There is no restart for a campaign; to send again, duplicate it. Duplicating and sending re-bills for everyone it reaches, including contacts who received the original.

## Common questions

**We paused for two weeks. Will contacts get all the messages they missed at once?** Only if you choose Send now on resume. Choose Spread over, and enable Skip time-sensitive steps for anything that has a date in it.

**Does pausing save us money?** It avoids billing for messages that were not sent. It does not reduce your plan fee, and enrolled contacts still count toward audience. If the goal is to reduce audience count, exit contacts from the workflow rather than pausing it.

**We restarted by mistake. Can we undo it?** No. Pause the workflow immediately to stop further sends, then contact Support with the workflow ID. Support can help you exit contacts who have not yet received a repeated message. Messages already delivered are billed.

**Can a Viewer see whether a workflow is paused?** Yes. Viewers see status and reports. They cannot change status.

## Revision history

| Version | Date       | Change                                          |
| ------- | ---------- | ----------------------------------------------- |
| v1.0    | 2025-05-06 | Initial guide                                   |
| v1.1    | 2025-11-18 | Added Spread over and Skip time-sensitive steps |
| v1.2    | 2026-04-14 | Added summary table and campaign section        |
