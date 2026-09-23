# Beacon Workspace Data Requests: Export, Access, and Deletion

| Field          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Doc ID         | CS-DSR-2026-03                                                                      |
| Version        | v1.1                                                                                |
| Owner          | Security & Compliance                                                               |
| Document owner | Priya Shah, Security Lead                                                           |
| Last reviewed  | 2026-03-11                                                                          |
| Classification | Customer                                                                            |
| Related        | Data Retention by Plan (CS-RET-2026-01), Developer API Quickstart (DEV-API-2026-06) |

## Who this is for

You are a workspace Admin and you need to get data out of Beacon, either for your own purposes (a migration, an audit, a backup) or because one of your contacts has asked you what you hold about them, asked for a copy, or asked you to delete it.

This guide covers what you can do yourself in the product, which is nearly everything, and the few cases where you need Beacon Support.

Only Admins can export or delete workspace data. Editors and Viewers see the Administration → Data page but the actions are disabled. If you are not an Admin, ask one, or ask to be granted the role in Administration → Members.

## Your role and Beacon's role

Beacon processes contact data on your instructions to provide the service. The contacts in your workspace are your contacts. When one of them asks about their data, they ask you, and you fulfill the request using the tools below. Beacon does not respond to your contacts directly, and if a contact writes to Beacon about a workspace they do not administer, Beacon refers them to you.

Which laws govern a request depends on where you and the contact are. Follow local law. Beacon's tools are designed to make the common obligations (access, portability, correction, deletion) quick to fulfill, but Beacon does not determine whether a given request is valid or what your deadline is.

## Full workspace export

Use this for migrations, backups, or audits.

1. Open Administration → Data → Export.
2. Choose **Full export**.
3. Select what to include: contacts, events, content, configuration. Contacts and events are the large ones.
4. Choose a format: CSV (one file per object type) or JSON Lines.
5. Confirm. Beacon emails you when the archive is ready.

Small workspaces finish in minutes. Large workspaces can take several hours. The export runs in the background; you can leave the page.

The archive is delivered as a download link on the Data page, not as an email attachment. The link is valid for seven days and requires you to be signed in as an Admin. Beacon does not email archives, because email is not a safe way to move an audience list.

Event data in the export is limited to your plan's retention period. See Data Retention by Plan (CS-RET-2026-01).

Full exports are logged in the workspace audit log with the requesting Admin's name.

## Contact-level access request

When a contact asks what you hold about them:

1. Open the contact from Segments or by searching their email or external ID.
2. Choose **Export contact**.
3. Beacon produces a JSON file with the contact's attributes, consent history, segment memberships, every message they were sent, and every event recorded for them within the retention period.

The file is downloaded to your browser directly. It is meant to be reviewed by you and, if appropriate, provided to the contact through your own channel. Review it first; attribute fields sometimes contain internal notes you would not want to forward verbatim.

For contacts you cannot find by email, remember they may exist under a different address or only under an external ID. Search both. A contact who unsubscribed is still a contact; suppression does not delete the record.

## Contact-level correction

Edit attributes directly on the contact record, or update through the API with `contacts:write`. Consent status can be changed to `opted_out` at any time; it cannot be changed from `opted_out` back to `opted_in` by an Admin, because that would override the contact's own choice. The contact resubscribes through your form or by texting START.

## Contact-level deletion

When a contact asks you to delete their data:

1. Open the contact and choose **Delete contact**.
2. Beacon asks whether to also add the email and phone number to the suppression list. Choose **Yes** in most cases: deleting a contact without suppressing them means the next import could re-create them and message them.
3. Confirm.

Deletion removes the contact record, attributes, segment memberships, and contact-level event detail within 24 hours. Aggregate campaign counts are unaffected; a deleted contact's open still counts toward the campaign's open total, but nothing in that total identifies them.

Deleted contacts are removed from backups as backups cycle out, within 35 days.

Suppression entries hold only a one-way hash of the address or number, so the suppression list does not itself retain the contact's data.

Bulk deletion: from Segments, select a segment and choose **Delete contacts in segment**. Admins only; Beacon requires you to type the count to confirm. There is no undo.

Deletion through the API uses `DELETE /v1/contacts/{external_id}` with the same suppression option as a query parameter.

## Deleting the whole workspace

Administration → Data → Delete workspace. Admins only. Beacon requires the workspace name typed in full and a 48-hour waiting period during which any Admin can cancel. After that, the workspace, its contacts, events, content, and aggregates are deleted permanently.

Deleting the workspace does not cancel your subscription. Cancel first under Administration → Billing if that is your intent, or you will be billed for an empty workspace. A deleted workspace does not create a refund; see the Billing and Refund Policy for what is refundable.

## Requests that need Beacon Support

Nearly all requests are self-serve. Contact Support when:

- The export has been running for more than 24 hours.
- You need an export of a workspace whose only Admin has left your company. Beacon verifies your organization's ownership before granting Admin to someone else; expect to provide evidence from your company domain.
- You need Beacon to confirm in writing that a deletion has completed, for your own records. Support provides a deletion confirmation with the date and the contact count.
- You believe a contact exists in Beacon's systems outside your workspace. Beacon does not hold contact data outside customer workspaces except for suppression hashes and abuse reports, but Support will check.

Support cannot email you an export archive, cannot restore a deleted contact, and cannot bypass the 48-hour workspace deletion wait.

## Sub-processors

Beacon uses a small number of sub-processors to provide the service (infrastructure hosting, email and SMS delivery partners, support tooling). The current list is published in the Beacon trust center and updated when it changes. Workspace Admins can subscribe to change notifications from the trust center.

## Requests from law enforcement or courts

If Beacon receives a legal demand for data in your workspace, Beacon's Security & Compliance team reviews it. Where Beacon is permitted to, it notifies your Admins and gives you the opportunity to respond. Where a legal hold applies, retention and deletion for the affected workspace are paused until the hold is lifted, and you will be unable to delete the affected contacts during that period. Beacon tells you when this is the case.

## Summary

| Need                         | Where                                    | Who                       | Output                  |
| ---------------------------- | ---------------------------------------- | ------------------------- | ----------------------- |
| Full export                  | Administration → Data → Export           | Admin                     | Download link, 7 days   |
| One contact's data           | Contact record → Export contact          | Admin                     | JSON download           |
| Correct a contact            | Contact record, or API                   | Admin, Editor, or API key | Updated record          |
| Delete a contact             | Contact record → Delete contact          | Admin                     | Removed within 24 hours |
| Delete many contacts         | Segment → Delete contacts in segment     | Admin                     | Removed within 24 hours |
| Delete workspace             | Administration → Data → Delete workspace | Admin, 48-hour wait       | Permanent               |
| Deletion confirmation letter | Support ticket                           | Admin                     | Written confirmation    |

## Revision history

| Version | Date       | Change                                                                 |
| ------- | ---------- | ---------------------------------------------------------------------- |
| v1.0    | 2025-06-24 | Initial guide                                                          |
| v1.1    | 2026-03-11 | Added bulk deletion and suppression hash note; clarified Support scope |
