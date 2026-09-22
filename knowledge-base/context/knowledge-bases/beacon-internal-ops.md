# Knowledge Base: Beacon Internal Ops

Served by the `beacon-ops-kb` MCP. Powers `/internal`.

## Title

```
Beacon Internal Ops
```

## Purpose

```
Internal operations Knowledge Base for Beacon staff. Covers incident response and severity comms, on-call, customer onboarding, billing disputes and credits, deliverability complaints, churn saves, customer data export, vendor security review, and sales objection handling. Staff-only; not customer-facing.
```

## Sources

### Files

Upload every PDF in `studio/seed/files/internal/` (12 files: Confluence exports, runbooks, two sales notes). The `.md` beside each PDF is the editable source; Markdown is also accepted as a file source if you would rather upload those.

| File                                        | Kind              |
| ------------------------------------------- | ----------------- |
| `confluence-incident-response.pdf`          | Confluence export |
| `confluence-sev-comms-and-status-page.pdf`  | Confluence export |
| `confluence-oncall-roster.pdf`              | Confluence export |
| `confluence-customer-onboarding-motion.pdf` | Confluence export |
| `confluence-vendor-security-review.pdf`     | Confluence export |
| `runbook-billing-disputes.pdf`              | Runbook           |
| `runbook-issue-credit-admin-tool.pdf`       | Runbook           |
| `runbook-data-export.pdf`                   | Runbook           |
| `runbook-deliverability-complaints.pdf`     | Runbook           |
| `runbook-churn-save-play.pdf`               | Runbook           |
| `sales-pricing-objection-handling.pdf`      | Sales note        |
| `sales-competitive-note-legacy-esp.pdf`     | Sales note        |

No dataset source. Structured policy records (`policy`) are served live through the `beacon-ops` GROQ MCP instead, so review dates and importance are always current.

## After the first build

Open **Issues** and resolve anything the build flags. Approval thresholds (for example the $500 credit limit) are on the `policy` documents; if a runbook disagrees, prefer the policy.
