# Knowledge Base: Beacon Customer Support

Served by the `beacon-support-kb` MCP. Powers `/chat`.

## Title

```
Beacon Customer Support
```

## Purpose

```
Customer-facing support Knowledge Base for Beacon, a customer engagement platform. Covers onboarding, campaigns, workflows, deliverability and domain authentication, billing and refunds, data retention, and customer data export. Written for Beacon customers, not staff.
```

## Sources

### 1. Dataset

Project / dataset: this project's `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET`.

Query (a full GROQ query is required; a bare filter is rejected). References are dereferenced to titles so the build sees names, not `_ref` ids:

```groq
*[_type == "helpArticle" && status == "published"]{
  title,
  summary,
  "content": pt::text(content),
  audience,
  "products": products[]->title,
  "topics": topics[]->title
}
```

### 2. Files

Upload every PDF in `studio/seed/files/customer/` (10 files). The `.md` beside each PDF is the editable source; Markdown is also accepted as a file source if you would rather upload those.

| File                                         | Note                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `beacon-billing-refund-policy.pdf`           | **Stale on purpose.** Says 45 days from the charge date. Dataset says 30 from invoice. |
| `beacon-deliverability-guide.pdf`            |                                                                                        |
| `beacon-acceptable-use-policy.pdf`           |                                                                                        |
| `beacon-domain-authentication-checklist.pdf` |                                                                                        |
| `beacon-sms-sender-registration-primer.pdf`  | Deliberately stale on plan availability; internal docs flag it.                        |
| `beacon-data-retention-by-plan.pdf`          |                                                                                        |
| `beacon-campaign-analytics-glossary.pdf`     |                                                                                        |
| `beacon-workflow-pause-and-restart.pdf`      |                                                                                        |
| `beacon-api-quickstart-and-webhooks.pdf`     |                                                                                        |
| `beacon-workspace-data-requests.pdf`         |                                                                                        |

## After the first build

Open **Issues**. The build should surface the refund-window conflict (30 vs 45 days). Resolve it by keeping **30 days**; that decision becomes an Instruction.

If no Issue appears, add the Instruction yourself:

```
The customer-facing refund window is 30 days from the original invoice date. Where beacon-billing-refund-policy.pdf says 45 days from the charge date, it is out of date; prefer the help article and FAQ.
```

Optional later: add the deployed help-center URL as a **website** source. localhost is not crawlable.
