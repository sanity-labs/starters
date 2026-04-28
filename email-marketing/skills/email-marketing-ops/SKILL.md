---
name: email-marketing-ops
description: Operate the email-marketing starter end-to-end with Resend - deploying Sanity Functions, debugging webhook failures, recovering from failed sends, re-syncing segments, monitoring campaign performance. Trigger on - operations, deploy functions, webhook failure, send failure, segment sync issue, campaign performance, ops, runbook.
---

# Email Marketing Ops with Sanity & Resend

This skill is the operator's runbook for the email-marketing starter post-Resend swap. It covers running, deploying, and debugging the live system — not just integrating with it. Use it when something is broken, when shipping a function change, or when onboarding a new operator.

For the architectural integration view (which Resend SDK calls live where), see the sibling skill `resend-integration`. This skill assumes that integration is in place and you're now operating it.

## Mental model

Three runtimes, one dataset:

1. **Studio** (`studio/`) — content editing, approval workflow, manual segment-sync trigger
2. **Frontend** (Next.js, `frontend/`) — preview rendering and the inbound engagement webhook
3. **Sanity Functions** (`functions/`) — the only place that calls the Resend SDK for sending and segment sync

There is **no shared connector package**. Earlier drafts described a `@starter/esp-connector` abstraction; that was removed during the Resend swap. Each function imports `resend` directly. If you're trying to find where a Resend call lives, read the function — there's no indirection layer.

## Surface map

| Surface          | File                                                  | What it does                                                                                                                                 |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Send             | `functions/on-promotion-approved/index.ts`            | `resend.broadcasts.create({segmentId, from, subject, html})` → `resend.broadcasts.send(id)` → persist `broadcast.id` as `externalCampaignId` |
| Segment sync     | `functions/import-resend-segments/index.ts`           | `resend.segments.list()` + `resend.contacts.list({segmentId})`; partial-patches `segment` docs (preserves enrichment)                        |
| Scheduled sync   | `functions/scheduled-import-resend-segments/index.ts` | Cron (`every 5 minutes`); flips `espImport.importState = 'requested'`                                                                        |
| Webhook ingest   | `frontend/app/api/webhooks/engagement/route.ts`       | Svix-verified; maps `email.opened` → `openRate++`, `email.clicked` → `clickThroughRate++`                                                    |
| Local preview    | `frontend/app/api/preview/resend/[id]/route.ts`       | `@react-email/render` — no Resend call required                                                                                              |
| Studio deep-link | `studio/components/OpenResendAction.tsx`              | Opens `https://resend.com/broadcasts/{externalCampaignId}`                                                                                   |
| Blueprint        | `sanity.blueprint.ts`                                 | Triggers + cron + robot token                                                                                                                |

## Setup

### One-time per environment

```bash
# 1. Install
pnpm install                       # from project root or starter root

# 2. Set env on the function runtime (per function, repeat for each)
npx sanity functions env add on-promotion-approved RESEND_API_KEY re_xxx
npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"
npx sanity functions env add import-resend-segments RESEND_API_KEY re_xxx
# scheduled-import-resend-segments doesn't call Resend directly — it just flips a state field

# 3. Set env on the frontend (used by the preview route + webhook handler)
# in frontend/.env:
#   RESEND_API_KEY=re_xxx
#   RESEND_WEBHOOK_SECRET=whsec_xxx
#   RESEND_FROM_EMAIL=Brand <updates@example.com>
```

`pnpm bootstrap` runs deploy + schema + typegen + seed and prompts for the keys above. Use it for fresh environments.

### Verifying a sending domain

Resend will refuse to send until SPF + DKIM TXT records resolve. In Resend dashboard → Domains → Add Domain → publish the records → wait for verification → use a `from` on that domain. For dogfood-only testing, `from: 'onboarding@resend.dev'` works but only delivers to your own Resend account email.

## Deploying functions

This is the part that catches new operators. Functions run in Sanity's runtime, deployed via Sanity Blueprints.

```bash
# 1. Build (from functions/ — the build outputs to functions/dist/)
cd functions && pnpm run build && cd ..

# 2. Deploy from PROJECT ROOT (where sanity.blueprint.ts lives)
npx sanity blueprints deploy
```

**Do not run `npx sanity blueprints deploy` from inside `functions/`.** The blueprint's `src` paths are project-root-relative (e.g. `functions/dist/on-promotion-approved`); running from `functions/` doubles the path and the deploy fails with a confusing "source not found" error.

Code changes in `functions/` are **not** picked up until you rebuild and redeploy. There is no hot reload for deployed functions.

### Verifying a deploy

```bash
npx sanity functions list                # confirm names + last deploy time
npx sanity functions logs on-promotion-approved --tail
```

The names should match the blueprint exactly — `on-promotion-approved`, `import-resend-segments`, `scheduled-import-resend-segments`. If you see anything else, the blueprint is stale; rebuild and redeploy.

## Runbooks

### Send fails — promotion approved but no email arrives

1. **Check function logs**

   ```bash
   npx sanity functions logs on-promotion-approved --tail
   ```

   Look for: `[on-promotion-approved] RESEND_API_KEY not set`, Resend SDK errors (`from` rejected, segment not found), or thrown exceptions.

2. **Check workflow state**

   In Studio, open the promotion. If `workflow.state.status` is `approved` but never moved to `sent`, the function ran but threw before persisting state. The history field on `workflow.state` will show the last successful step.

3. **Check `externalCampaignId`**

   If it's null, `resend.broadcasts.create` failed. Common causes:
   - `RESEND_FROM_EMAIL` references an unverified domain → Resend returns a clear error in logs
   - `segmentId` (from `promotion.segment->externalId`) is stale or refers to a deleted Resend segment
   - API key was rotated; old key still on function runtime

4. **Verify env vars on the runtime**

   ```bash
   npx sanity functions env list on-promotion-approved
   ```

   `RESEND_API_KEY` and `RESEND_FROM_EMAIL` must both be present.

5. **Recover**

   The function is idempotent on the broadcast-create step _only if_ you reset `workflow.state.status` to `draft` (re-approving from `approved` is a no-op). Workflow:
   - Studio: open promotion → set workflow back to `draft` → re-approve.
   - Or patch directly: `client.patch(workflowId).set({status: 'draft'}).commit()`.

   If the broadcast was created in Resend but the send call failed, the broadcast lives in the Resend dashboard as a draft. You can either send it manually from there or delete it and re-approve.

### Webhook failures — opens/clicks don't update `campaignPerformance`

1. **Confirm the webhook is registered in Resend**

   Resend dashboard → Webhooks → endpoint should be `https://<frontend>/api/webhooks/engagement` and subscribed to at least `email.opened` and `email.clicked`.

2. **Check the route logs**

   In Vercel (or wherever the frontend runs), tail the route. 401s mean Svix verification failed. 200 with no patch means the broadcast id didn't match any promotion.

3. **Svix verification 401 — common causes**
   - `RESEND_WEBHOOK_SECRET` not set, or set to the API key by mistake (it should start with `whsec_`)
   - Body parsed before verification — Svix requires the raw request body. The route calls `request.text()` first; do not refactor it to use `request.json()` and re-stringify.
   - Wrong webhook secret. Resend generates one secret _per webhook endpoint_. Re-copy from the dashboard and update `RESEND_WEBHOOK_SECRET`.

4. **200 but no update — the broadcast id doesn't match**

   The route looks up the promotion via `*[_type == "promotion" && externalCampaignId == $id][0]._id`, where `$id` is `event.data.broadcast_id`. If `externalCampaignId` was never persisted (send-flow failure above), the webhook silently no-ops. Fix the send flow first.

5. **Replay**

   Resend dashboard → Webhooks → endpoint → Logs → click an event → Replay. The route is idempotent on opens/clicks because they only increment, but replays will double-count. Avoid replaying for individual events; use replay for verification fixes only.

### Segment sync stuck or stale

1. **Check current state**

   ```groq
   *[_type == "espImport"][0]{importState, lastImportedAt, importErrorMessage, segmentCount}
   ```

   States: `idle`, `requested`, `importing`, `imported`, `error`.

2. **Manual re-sync from Studio**

   Sidebar → Resend → Sync / Import → click **Sync with Resend**. This patches `importState = 'requested'`, which fires `import-resend-segments`.

3. **Cron is silent** (scheduled function not firing)

   ```bash
   npx sanity functions logs scheduled-import-resend-segments --tail
   ```

   No output for >5 min means the cron isn't running. Check the blueprint:
   - The scheduled function needs `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` injected via the blueprint's `env: {…}` (it doesn't get these from a triggering doc).
   - The robot token resource must be present and referenced as `robotToken: '$.resources.email-marketing-robot.token'`.
   - Redeploy: `cd functions && pnpm run build && cd .. && npx sanity blueprints deploy`.

4. **Sync failed — `importState` is `error`**

   `importErrorMessage` on the doc has the message. Common causes:
   - `RESEND_API_KEY` missing or invalid on the function runtime
   - Resend rate limit hit during pagination of `contacts.list` → re-sync usually clears it
   - A transient Resend API error → click Sync again

5. **Enrichment fields disappeared after sync**

   This is a regression — sync is supposed to use a _partial_ patch on synced fields only (`externalId`, `name`, `memberCount`, `isActive`). If `affinityDescription`/`typicalCopyTone`/`engagementTier` are wiped, the function is using `createOrReplace` instead of `client.patch().set({...syncedFields})`. Fix in `functions/import-resend-segments/index.ts` and redeploy.

### Adding a new segment in Resend

1. Create the segment in Resend dashboard, add contacts.
2. Either click **Sync with Resend** in Studio, or wait up to 5 minutes for the cron.
3. The new `segment` document appears under sidebar → Resend → Segments. CRM manager fills in the enrichment fields.
4. Segment is now selectable in `campaign.segments`.

### Rotating the Resend API key

```bash
npx sanity functions env add on-promotion-approved RESEND_API_KEY re_new_key
npx sanity functions env add import-resend-segments RESEND_API_KEY re_new_key
# Update frontend/.env locally and on the deploy target (Vercel etc.)
```

No redeploy required for env-only changes — runtimes pick up new env on the next invocation. Test by triggering a sync and verifying logs.

## Monitoring campaign performance

`promotion.campaignPerformance` is the canonical record:

```ts
{
  openRate: number,           // incremented per email.opened webhook
  clickThroughRate: number,   // incremented per email.clicked webhook
  // bounceCount: not currently stored — see ESP-NOTES.md
  // conversionRate: no Resend source — see ESP-NOTES.md
}
```

To watch a campaign live: open the promotion in Studio. The campaign-grid view (`studio/plugins/campaign/components/CampaignGridView.tsx`) shows performance per segment.

For ad-hoc checks:

```groq
*[_type == "promotion" && campaign._ref == $campaignId]{
  segment->{name},
  externalCampaignId,
  campaignPerformance,
  workflow->{status, sentAt}
}
```

Cross-check against Resend dashboard → Broadcasts → click the broadcast → Analytics. Numbers will lag webhook ingestion by a few seconds; sustained drift means webhooks aren't landing — see "Webhook failures" above.

## Functional gaps

Resend is not a behavioral marketing platform. The starter does not implement, and cannot easily implement:

- **Behavioral / dynamic segments** — Resend Segments are static lists. Filter logic must run in Sanity Functions.
- **Flows / journeys / triggered automations** — out of scope for Resend.
- **Conversion attribution** — there's no `Placed Order` event from Resend webhooks. The `conversionRate` field has no source.
- **Server-side template render API** — preview must be rendered locally.
- **A/B testing of subject lines or send times** — not in Resend.

Full guidance and workarounds: [`docs/ESP-NOTES.md`](../../docs/ESP-NOTES.md).

## Useful commands

```bash
# Functions
npx sanity functions list
npx sanity functions logs on-promotion-approved --tail
npx sanity functions env list on-promotion-approved
npx sanity functions env add <fn-name> <KEY> <value>

# Blueprint
npx sanity blueprints deploy            # from project root
npx sanity blueprints list

# Local
cd functions && pnpm run build          # rebuild before deploy
pnpm typecheck                          # all workspaces
pnpm bootstrap                          # full setup on a fresh env
```

## References

- `resend-integration` skill — architectural view of the Resend integration
- `swap-esp-resend` skill — historical record of the ESP migration to Resend
- `docs/ARCHITECTURE.md` — full system architecture
- `docs/ESP-NOTES.md` — functional gaps and workarounds
- `docs/SECURITY.md` — preview service defense layers
- `sanity.blueprint.ts` — function trigger config (read this when triggers misbehave)
