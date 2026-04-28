---
name: swap-esp-resend
description: Replace Klaviyo with Resend in the email-marketing starter end-to-end. Rewrites Sanity Functions (send, segment sync, scheduled sync), Studio actions/badges/structure, schemas, frontend preview route, engagement webhook, render package, env vars, seed data, and docs. Migrates HMAC webhook verification to Svix, removes server-side template rendering, and switches to react-email local rendering. Trigger on - swap ESP, replace Klaviyo, migrate to Resend, change email service provider, ESP migration.
---

# Swap Klaviyo for Resend

This skill performs a complete, one-time swap of Klaviyo for Resend in the email-marketing starter. After running it, every Klaviyo touchpoint is gone — replaced with Resend equivalents — and a working dogfood branch can deploy and send live email.

## When to use

- The user asks to swap Klaviyo for Resend, change ESPs, or migrate the starter to a different email provider.
- An agent is executing one or more rows of the touchpoint checklist on behalf of the user.

## Before you start: ground on current Resend docs

Your training data on Resend is likely stale. **Always fetch `https://resend.com/llms.txt` first** — it's Resend's canonical AI entry point and links to OpenAPI, the Node SDK, MCP, and reference docs. Only use the Resend MCP server (`npx -y resend-mcp`) if you need to _exercise_ the Resend API at runtime; it's not a docs lookup tool.

See `references/resend-cheatsheet.md` for the durable summary that's been verified against Resend docs as of 2026-04-28.

## Functional gaps you must surface to the user up front

Resend is not a 1:1 replacement for Klaviyo. The skill must call this out before changes start, not after:

- **No behavioral/dynamic segmentation.** Resend Segments are static contact lists. Klaviyo's filter-based segments do not have an equivalent — anything dynamic must be implemented in Sanity Functions.
- **No flows/automations/journeys.** Resend has no triggered campaigns.
- **No metric events ingestion.** Webhooks are delivery-side only (open, click, bounce). Klaviyo's "Placed Order" → `conversionRate` mapping has no equivalent. Document or remove.
- **No server-side template render API.** The Klaviyo preview route's "render via Klaviyo" path goes away — react-email components render locally via `@react-email/render`.
- **Webhook signing is Svix, not HMAC-SHA256.** Headers and verification API are different.

See `references/klaviyo-to-resend-mapping.md` for the full concept map.

## Inputs to collect from the user

Ask up front (use AskUserQuestion or plain prompts):

1. **Resend API key** — format `re_…`. Lands in `email-marketing/.env` (gitignored) as `RESEND_API_KEY=…` AND on Sanity Functions runtime via `npx sanity functions env add RESEND_API_KEY <key>`. Frontend `.env` also needs it for the preview route.
2. **Verified sending domain + from-address** — e.g. `updates@example.com`. Resend will not send before SPF + DKIM TXT records are verified in the Resend dashboard. Set `RESEND_FROM_EMAIL` and `RESEND_DOMAIN` in env.
3. **Webhook signing secret** — created when the user registers a webhook endpoint in the Resend dashboard. Lands as `RESEND_WEBHOOK_SECRET` in frontend `.env`.
4. **Keep the now-static segment sync?** — recommended yes (Resend Segments still need to land in Sanity for targeting). The synced shape becomes `{externalId, name, memberCount}`; the editorial enrichment fields (`affinityDescription` etc.) stay editable.
5. **Drop `conversionRate`?** — recommended yes (no Resend equivalent). Or leave it as a documented external-event hook for the user to wire later.

## Touchpoint checklist (execute in order)

These rows are also expanded with file-by-file diff intent in `references/touchpoint-checklist.md`. Surface assignments map to the email-marketing 6-agent team (Functions Engineer, Frontend, Email Renderer, Schema Architect, QA Marketer, AI Inspector).

| #   | Surface                     | Files                                                                                                                                                                                                                                                                                                                                                                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Deps                        | `functions/package.json`, `frontend/package.json`, `packages/render-email/package.json`                                                                                                                                                                                                                                                                                                          | Remove `klaviyo-api`. Add `resend`. Confirm `@react-email/components` and `@react-email/render` are present (add if missing).                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Schema                      | `studio/schemaTypes/klaviyoImport.ts`                                                                                                                                                                                                                                                                                                                                                            | Rename to `espImport.ts` (keep doc type id stable if seed data uses it; otherwise rename type). Update titles/descriptions to "Resend". `externalId` field is already ESP-agnostic — leave it.                                                                                                                                                                                                                                                                                                         |
| 3   | Studio plugin               | `studio/plugins/klaviyo/` → `studio/plugins/esp/`                                                                                                                                                                                                                                                                                                                                                | Rename folder, badges, action exports. `OpenKlaviyoAction` → `OpenResendAction`, links to `https://resend.com/broadcasts/{id}`.                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | Studio components           | `studio/components/ImportFromKlaviyoAction.tsx`, `KlaviyoImportDescription.tsx`, `OpenKlaviyoAction.tsx`                                                                                                                                                                                                                                                                                         | Rename + relabel. Imports updated everywhere they're referenced.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5   | Studio structure/config     | `studio/structure.ts`, `studio/sanity.config.ts`                                                                                                                                                                                                                                                                                                                                                 | Sidebar label "Klaviyo" → "Resend". `productionUrl`: `/api/preview/klaviyo/{id}` → `/api/preview/resend/{id}`.                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | Promotion approve/inspector | `studio/plugins/promotion/documentActions/ApproveAction.tsx`, `inspector/PreviewStatusInspector.tsx`                                                                                                                                                                                                                                                                                             | Copy: "Approve and send via Resend?", "Delivered via Resend".                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | Function: segment sync      | `functions/import-klaviyo/index.ts` → `functions/import-resend-segments/index.ts`                                                                                                                                                                                                                                                                                                                | Use `new Resend(apiKey).segments.list()` for the segment list. Use `resend.contacts.list({segmentId})` and count for `memberCount`. Drop the v2025-07-15 Klaviyo revision header logic. Resend Segments don't expose a definition string — drop `description` from the synced layer (or set to empty).                                                                                                                                                                                                 |
| 8   | Function: scheduled sync    | `functions/scheduled-import-klaviyo/index.ts` → `functions/scheduled-import-resend-segments/index.ts`                                                                                                                                                                                                                                                                                            | Identical state-machine — flip `espImport.importState` to `"requested"` on cron. Just renamed.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 9   | Function: send              | `functions/on-promotion-approved/index.ts`                                                                                                                                                                                                                                                                                                                                                       | **Heaviest rewrite.** Drop `klaviyo-api` SDK. Use `resend.broadcasts.create({segmentId, from, subject, html})` then `resend.broadcasts.send(id)`. Persist returned `broadcast.id` as `externalCampaignId`. Drop the create-template + assign-template-to-message ceremony entirely. The `buildHtml` function stays — Resend accepts raw HTML via `html:`. Replace the unsubscribe merge tag (see row 14).                                                                                              |
| 10  | Blueprint                   | `sanity.blueprint.ts`                                                                                                                                                                                                                                                                                                                                                                            | Update function names to match renames. Cron schedule unchanged. Robot token unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | Frontend preview route      | `frontend/app/api/preview/klaviyo/[id]/route.ts` → `frontend/app/api/preview/resend/[id]/route.ts`                                                                                                                                                                                                                                                                                               | Resend has no server-render API. Render react-email components locally via `render()` from `@react-email/render`. Remove the create-template / call-render-API / delete-template dance. Faster + simpler. Drop `X-Preview-Status` header values that referenced Klaviyo accuracy or set them to `"local-render"`.                                                                                                                                                                                      |
| 12  | Frontend webhook            | `frontend/app/api/webhooks/engagement/route.ts`                                                                                                                                                                                                                                                                                                                                                  | Replace HMAC-SHA256 / `X-Klaviyo-Request-Signature` / `X-Klaviyo-Request-Timestamp` with Svix verification. Headers: `svix-id`, `svix-timestamp`, `svix-signature`. Verify on raw body with `resend.webhooks.verify({payload, headers, webhookSecret})`. Map event types: `email.opened` → `openRate++`, `email.clicked` → `clickThroughRate++`, `email.bounced` → bounce log. Drop the `Placed Order` → `conversionRate` increment (no Resend equivalent) — leave a comment pointing to ESP-NOTES.md. |
| 13  | Env vars                    | `frontend/.env.example`, root README env table, function runtime env                                                                                                                                                                                                                                                                                                                             | Remove `KLAVIYO_API_KEY`, `KLAVIYO_WEBHOOK_SECRET`. Add `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL`, `RESEND_DOMAIN`.                                                                                                                                                                                                                                                                                                                                                               |
| 14  | Render package              | `packages/render-email/src/index.ts`                                                                                                                                                                                                                                                                                                                                                             | Rename `renderPromotionKlaviyo` → `renderPromotion`. Replace Klaviyo merge tags: `{{ unsubscribe_url }}` → `{{{RESEND_UNSUBSCRIBE_URL}}}` (triple-brace). Update `stubKlaviyoTags` → `stubResendTags`. Same change in `functions/on-promotion-approved/index.ts` `buildHtml` (currently emits `{{ unsubscribe_url }}` literals).                                                                                                                                                                       |
| 15  | Seed/sample data            | `studio/seed/*.ndjson`                                                                                                                                                                                                                                                                                                                                                                           | Replace any `externalId: "klaviyo-…"` placeholders with `resend-…`. Remove any `klaviyoImport` doc that becomes `espImport`.                                                                                                                                                                                                                                                                                                                                                                           |
| 16  | Docs + skills               | `README.md`, `AGENT.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, new `docs/ESP-NOTES.md`, replace `skills/klaviyo-integration/` with `skills/resend-integration/`, update `skills/esp-connector-pattern/SKILL.md` to mention Resend (or mark as out-of-date — those skills currently describe an aspirational `@starter/esp-connector` package that doesn't actually exist; flag this to the user). |

## Verification

Run after the swap:

```bash
cd email-marketing
pnpm install
pnpm typecheck
pnpm build
```

Then deploy:

```bash
npx sanity functions env add RESEND_API_KEY <key>   # function runtime
cd functions && pnpm run build && cd ..
npx sanity blueprints deploy                         # from project root
```

Live send test:

1. In Resend dashboard, create a Segment with one contact (your own email).
2. In Sanity Studio, sync segments (or wait for the 5-min cron).
3. Build a test promotion targeting that segment, hit Approve.
4. Confirm: email arrives. Open it. Click a link.
5. Confirm in Studio: `promotion.campaignPerformance.openRate` and `clickThroughRate` increment.

If any step fails, _do not silently fix and move on_ — flag what was unclear in this skill so it can be improved.

## Working as a sub-agent under this skill

If you're one of the email-marketing team agents (Functions Engineer / Frontend / Email Renderer / Schema Architect / QA Marketer / AI Inspector) executing rows of the checklist above, your contract is:

1. **Read your assigned rows + `references/touchpoint-checklist.md` first.**
2. **Do not improvise architecture.** If a step is ambiguous, ask the orchestrator (the main thread). Don't silently invent abstractions.
3. **Report back deviations.** Any time you had to make a judgment call the skill didn't cover, flag it explicitly in your final report.
4. **Don't run destructive ops** (`git push`, blueprint deploy, function-runtime env changes) without orchestrator approval. Local file edits and `pnpm install` are fine.

## Lessons from the dogfood swap (folded into this skill)

The first run of this skill (Klaviyo→Resend on the email-marketing starter) surfaced these gaps. They are fixed in `references/touchpoint-checklist.md` and `references/resend-cheatsheet.md`, but worth knowing about:

- **Resend SDK is at v6.x.** Earlier docs (and most agent training data) describe v4-era APIs. `audienceId` is deprecated; only `segmentId` is valid on `broadcasts.create`. `previewText` IS a top-level field. The SDK return shape is `{data: {id}, error}`.
- **`packages/render-email/` uses MJML, not react-email.** Don't add `@react-email/render` to that package. The frontend preview route renders via MJML through `renderPromotionLocal`.
- **Resend Svix posts single events**, not arrays. Don't reuse Klaviyo's `events: [...]` parsing pattern.
- **Segment sync must use `createIfNotExists` + partial patch**, not `createOrReplace` — the latter clobbers the editable enrichment fields (`affinityDescription` etc.) on every sync.
- **Several files miss every specialist agent's scope** — see the "Files commonly missed" section in `references/touchpoint-checklist.md`. Plan for a cleanup pass after the parallel team finishes.
- **`ResendAction.tsx`** in the promotion plugin is named for the "re-send" workflow action. The naming collision with Resend the ESP is unfortunate. _Don't rename the file_; just update the copy strings inside.

## References

- `references/resend-cheatsheet.md` — Resend SDK, Svix webhooks, env, domain verification
- `references/klaviyo-to-resend-mapping.md` — concept map and feature gaps
- `references/touchpoint-checklist.md` — file-by-file diff intent for all 16 rows
