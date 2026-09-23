# Beacon Domain Authentication Checklist

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| Doc ID         | CS-DNS-2026-05                        |
| Version        | v2.2                                  |
| Owner          | Deliverability                        |
| Document owner | Marcus Lindqvist, Deliverability Lead |
| Last reviewed  | 2026-05-20                            |
| Classification | Customer                              |
| Related        | Deliverability Guide (CS-DEL-2026-02) |

## Before you start

You need three things: Admin access to your Beacon workspace, access to the DNS settings for the domain you send from, and about 20 minutes. DNS changes can take up to 48 hours to propagate, though most complete within an hour.

Decide which domain you will send from. Beacon recommends a dedicated subdomain such as `mail.yourcompany.example` or `news.yourcompany.example` rather than the root domain. A subdomain keeps marketing reputation separate from the domain your staff use for day-to-day email, so a bad campaign cannot hurt your invoices and support replies.

Only Admins can add or verify sending domains. If you are an Editor, ask an Admin to complete this checklist or to grant you the Admin role in Administration → Members.

## Step 1: Add the domain in Beacon

1. Open Channels → Email → Authentication.
2. Choose **Add sending domain** and enter the subdomain.
3. Beacon displays three record groups: SPF, DKIM, and DMARC. Leave this tab open.

Beacon generates the exact values. Copy them rather than typing them. A single missing character in a DKIM record is the most common reason a domain stays on **Pending**.

## Step 2: SPF

SPF is a TXT record on the sending subdomain that lists the servers allowed to send for it.

| Type | Host | Value                                    |
| ---- | ---- | ---------------------------------------- |
| TXT  | mail | `v=spf1 include:spf.beacon.example ~all` |

If the subdomain already has an SPF record (for example, because another tool sends from it), do not add a second one. Two SPF records on one host is an error and providers treat it as a failure. Merge instead: add `include:spf.beacon.example` to the existing record before the `~all`.

SPF has a limit of ten DNS lookups. Each `include` uses at least one. If your record already has several includes, Beacon's include may push you over. The Authentication page shows a lookup count once the record resolves. If it reads more than ten, remove includes you no longer use or move Beacon to its own subdomain.

## Step 3: DKIM

DKIM lets Beacon sign each message with a key tied to your domain. Beacon uses two CNAME records so we can rotate keys without asking you to update DNS.

| Type  | Host                     | Value                         |
| ----- | ------------------------ | ----------------------------- |
| CNAME | beacon1.\_domainkey.mail | `beacon1.dkim.beacon.example` |
| CNAME | beacon2.\_domainkey.mail | `beacon2.dkim.beacon.example` |

Some DNS hosts append your domain automatically to the Host field. If yours does, enter `beacon1._domainkey.mail`; if it does not, enter the fully qualified name `beacon1._domainkey.mail.yourcompany.example`. The Authentication page tells you which form your host expects once it detects the first record.

Do not turn the CNAME into a TXT record by copying a key value from another provider. Beacon's DKIM only works as a CNAME.

## Step 4: DMARC

DMARC is a TXT record on `_dmarc` that tells receiving providers what to do when a message fails SPF or DKIM, and where to send reports.

| Type | Host         | Value                                                    |
| ---- | ------------ | -------------------------------------------------------- |
| TXT  | \_dmarc.mail | `v=DMARC1; p=none; rua=mailto:dmarc@yourcompany.example` |

Start with `p=none`. That means "report but do not act," and it lets you confirm that everything aligns before providers begin quarantining. After two clean weeks, move to `p=quarantine`. Beacon shows a DMARC pass rate on the Authentication page so you can see when you are ready.

If your root domain already has a DMARC record, you do not need one on the subdomain; the root policy applies. Check that the root policy is not `p=reject` with strict alignment before you send, or your first campaign will be rejected outright.

The `rua` address receives aggregate reports from providers. They are XML and not meant to be read by hand. Beacon can receive them for you: use the address shown in the product instead of your own, and Beacon summarizes them in the Authentication tab.

## Step 5: Verify

Return to Channels → Email → Authentication. Beacon checks DNS every few minutes. Each record moves from **Pending** to **Verified** as it resolves. When all three are verified the domain shows **Authenticated** and becomes available as a From domain in Campaigns and Workflows.

If a record stays on Pending for more than an hour:

- Confirm you added it to the right zone. `mail.yourcompany.example` records live in the zone for `yourcompany.example` unless you delegated the subdomain.
- Check for a trailing period or a doubled domain in the Host field.
- Check that your DNS host did not wrap the TXT value in quotes twice.
- Run the **Recheck now** action. Beacon caches results for a few minutes.

## Step 6: Send a test

Create a campaign in Campaigns → New campaign, choose the new domain as the From address, and send a preview to yourself and to at least one address on a different provider. Open the message headers and confirm you see `spf=pass`, `dkim=pass`, and `dmarc=pass`.

## Checklist

| Done | Item                                                             |
| ---- | ---------------------------------------------------------------- |
|      | Chose a dedicated sending subdomain                              |
|      | Added the domain in Channels → Email → Authentication            |
|      | Added the SPF TXT record, merged if one already existed          |
|      | Added both DKIM CNAME records                                    |
|      | Added or confirmed a DMARC record, starting at p=none            |
|      | All three records show Verified                                  |
|      | Preview sent to two providers with all three passes in headers   |
|      | Calendar reminder set to move DMARC to p=quarantine in two weeks |

## Common problems

**"We authenticated months ago and now we are in spam."** Records can be removed by a DNS migration, a website redesign, or a colleague cleaning up "unused" entries. Check the Authentication page first. Beacon emails Admins when a verified record stops resolving, but the email is easy to miss.

**"SPF passes but DKIM fails."** Usually a CNAME converted to a TXT, or the host field entered with the domain doubled. Delete and re-add from the values Beacon shows.

**"DMARC fails even though SPF and DKIM pass."** Alignment. The domain in the From address must match the domain that passed SPF or DKIM. If you send from `yourcompany.example` but authenticated `mail.yourcompany.example`, relaxed alignment still passes; strict alignment does not. Beacon's default records use relaxed alignment.

**"Our IT team will not add records for a marketing tool."** Ask them to delegate the subdomain to you instead. A single NS record for `mail.yourcompany.example` pointing at a DNS host you control keeps their zone untouched.

## What happens without authentication

Beacon sends from a shared Beacon subdomain until your domain is authenticated. Test messages work. Production sending to a large list from the shared domain is discouraged and, at volume, may be rate-limited. You also cannot remove Beacon branding from the From address until authentication completes.

Authentication is required for email. SMS and push have their own registration steps, covered in the SMS Sender Registration Primer (CS-SMS-2025-08) and the Push section of the Deliverability Guide.

## Revision history

| Version | Date       | Change                                                    |
| ------- | ---------- | --------------------------------------------------------- |
| v2.0    | 2025-01-08 | Moved to two-CNAME DKIM                                   |
| v2.1    | 2025-09-16 | Added lookup count guidance                               |
| v2.2    | 2026-05-20 | Added delegation option; reworded DMARC alignment section |
