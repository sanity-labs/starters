# Runbook: Customer Data Export (Staff-Assisted)

| Field          | Value                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Doc ID         | OPS-SEC-2026-02                                                                                                   |
| Version        | v2.0                                                                                                              |
| Owner          | Support Operations                                                                                                |
| Document owner | Dana Okafor, Support Ops                                                                                          |
| Reviewed with  | Priya Shah, Security Lead                                                                                         |
| Last reviewed  | 2026-02-24                                                                                                        |
| Classification | Internal - do not forward                                                                                         |
| Related        | Workspace Data Requests (customer doc CS-DSR-2026-03), Data Retention by Plan (CS-RET-2026-01), Incident Response |

## Purpose

How Support and Solutions Engineers fulfill a data export when the customer cannot or should not do it themselves. Customers can export on their own from Administration → Data; that is always the first answer. This runbook is for the exceptions.

## When to use

- The customer's export has been running more than 24 hours.
- The workspace has no active Admin (the only Admin left the company).
- The customer needs a written deletion or export confirmation.
- A Solutions Engineer is running a migration and the customer has asked us to drive.
- Legal or Security has asked for an export as part of an incident.

## When not to use

- The requester is an Editor or Viewer asking us to bypass their Admin. Refer them to their Admin. We do not export around a customer's own permission model.
- The requester is a contact (an end recipient) asking about a workspace they do not administer. Refer them to the workspace owner. Beacon does not respond to contacts about customer workspaces.
- The workspace is under a legal hold. See Step 1.

## Steps

### 1. Check for a hold

Open the workspace in the admin tool. If the banner reads **Legal hold: Security & Compliance**, stop. Do not start an export, do not tell the customer why, and escalate to the Security lead named on the On-Call Roster (Priya Shah). Security decides whether and how the request is answered.

No banner: continue.

### 2. Verify the requester

Verify the requester is an Admin of the workspace before anything else. Administration → Members on the workspace, find the requester, confirm the role reads **Admin**. Confirm the ticket came from the email on the member record, not a personal address.

If the requester is not an Admin:

- Editor or Viewer: refer to their Admin. End.
- Claims to be the company's owner but has no Admin: this is an ownership recovery, not an export. Follow the ownership verification steps in the Account Recovery runbook (evidence from the company domain, sign-off from Support lead), grant Admin, then let them export themselves.

Do not accept "our Admin is on vacation" as a reason to export for an Editor.

### 3. Confirm what they need

Ask, and record in the ticket:

- Scope: full workspace, or one object type (contacts only, events only).
- Format: CSV or JSON Lines. CSV is one file per object type.
- Date range for events, if any. Remind them that event data is limited to their plan's retention period (Starter 90 days, Growth 13 months, Enterprise 25 months); anything older is already gone and is not in any backup they can have.
- Whether they need the export before a downgrade or cancellation takes effect. If so, note the renewal date; the export must complete before it.

### 4. Run the export

1. Open Administration → Data on the customer's workspace in the admin tool.
2. Choose **Full export** or the scoped export the customer asked for.
3. Select format.
4. Check the box **Requested by Beacon staff** and enter the ticket ID. This writes the staff export to the customer's audit log with your name and the ticket, which is what we want.
5. Confirm.

Large workspaces take hours. You can leave the page. The admin tool emails you when it completes, and the download link appears on the customer's own Administration → Data page as well as in the admin tool.

### 5. Deliver

**Do not email the archive.** Not to the customer, not to yourself, not to a colleague. Not as an attachment, not as a link to a personal drive.

The archive is delivered as a download link on the customer's Administration → Data page. It requires an Admin sign-in and expires after seven days. Tell the customer the export is ready and where to find it. That is the whole delivery step.

If the customer says they cannot download from there (corporate proxy, file size), offer to regenerate as scoped exports (contacts, then events by quarter) so the files are smaller. Do not move the archive anywhere else.

### 6. Confirmation letters

If the customer needs written confirmation of an export or a deletion for their own records, use the `data-confirmation` template. Fill in: workspace name, date, what was exported or deleted, contact count where applicable. Support lead signs. Send from the ticket.

## Migrations driven by a Solutions Engineer

Same steps. The SE runs the export from the admin tool with the ticket ID, the customer downloads from their Data page. The SE never holds the archive. If the customer wants the SE to load the data into the destination, the customer downloads and shares it through their own tooling, or the destination pulls it through the Beacon API with a key the customer created.

## Escalation

- Legal hold banner: Security lead. Do not proceed.
- Ownership dispute (two people claiming Admin, or an ex-employee requesting): Support lead plus Security.
- Export fails twice: B-rotation on-call. Might be an export job bug.
- Request references a regulator, a court, or a law firm: Security & Compliance, same day. We still fulfill valid Admin requests; Security just needs to know.

## Done when

- Hold checked, none present (or escalated).
- Requester verified as Admin from the member record.
- Scope, format, and range recorded.
- Export run with the ticket ID and the staff checkbox.
- Customer pointed to Administration → Data for download. No archive emailed or moved.
- Confirmation letter sent if requested.

## Revision history

| Version | Date       | Change                                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- |
| v1.2    | 2025-03-04 | Added migration section                                                                         |
| v2.0    | 2026-02-24 | Added hold check as step 1; aligned retention figures with CS-RET-2026-01; added staff checkbox |
