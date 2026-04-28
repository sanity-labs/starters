# Touchpoint checklist (file-by-file diff intent)

Each row is a discrete unit of work. The team agents executing this skill should claim rows by surface, not by row number. Order matters within an agent's surface (e.g., schema rename before structure update).

## Row 1 — Dependencies

**Files:**

- `email-marketing/functions/package.json`
- `email-marketing/frontend/package.json`

**Changes:**

- Remove dep: `klaviyo-api` (wherever it appears)
- Add dep: `resend@^6.12.0` (pin a major; don't write "latest")
- In `frontend/package.json`: also add `@react-email/render@^1.4.0` if not already present (used by the preview route).

**Don't:**

- Don't add `@react-email/render` or `@react-email/components` to `packages/render-email/`. That package renders via **MJML**, not react-email — they are different rendering pipelines, and adding unused deps is wasteful. Confirmed during the dogfood swap.

Run `pnpm install` from `email-marketing/` after all surfaces are done — typically the orchestrator does this once, not per-agent.

## Row 2 — Schema rename (klaviyoImport doc type)

**File:** `email-marketing/studio/schemaTypes/klaviyoImport.ts`

**Changes:**

- Rename file to `espImport.ts`.
- Inside: `defineType({name: 'klaviyoImport', ...})` → `defineType({name: 'espImport', ...})`.
- `title: 'Klaviyo Import'` → `title: 'ESP Import'` (or `'Resend Import'`).
- Update field titles/descriptions referencing Klaviyo.
- Field shape (`importState`, `lastImportedAt`, `listCount`, `segmentCount`, `importErrorMessage`) is preserved.

**Knock-on:**

- `email-marketing/studio/schemaTypes/index.ts` — update import name from `klaviyoImport` to `espImport`.
- Anywhere else that queries `*[_type == "klaviyoImport"]` — update GROQ.
- Seed data: `email-marketing/studio/seed/*.ndjson` — replace `_type: "klaviyoImport"` with `_type: "espImport"`.
- Studio structure (row 5) — list query updated.

**Don't:** keep both types. The doc type is being replaced, not extended.

## Row 3 — Studio plugin folder rename

**Files:** `email-marketing/studio/plugins/klaviyo/` → `email-marketing/studio/plugins/esp/`

**Inside:**

- `index.ts` — barrel exports renamed.
- `badges/LastSyncedBadge.tsx` — copy: "Synced from Resend" instead of "Synced from Klaviyo". Logic unchanged (it reads `lastImportedAt`).

**Imports:** every file that imports from `studio/plugins/klaviyo/` updates to `studio/plugins/esp/`. Check `studio/sanity.config.ts` first.

## Row 4 — Studio components rename

**Files:**

- `email-marketing/studio/components/ImportFromKlaviyoAction.tsx` → `ImportFromResendAction.tsx`
- `email-marketing/studio/components/KlaviyoImportDescription.tsx` → `EspImportDescription.tsx`
- `email-marketing/studio/components/OpenKlaviyoAction.tsx` → `OpenResendAction.tsx`

**Behavior changes:**

- `ImportFromResendAction.tsx`: copy says "Import from Resend"; patches `espImport.importState` (was `klaviyoImport.importState`). Logic identical.
- `OpenResendAction.tsx`: link target `https://www.klaviyo.com/campaign/{id}/reports` → `https://resend.com/broadcasts/{id}`. Reads `externalCampaignId` from promotion (field name unchanged).
- All copy ("Klaviyo" → "Resend") swept.

## Row 5 — Studio structure / config

**Files:**

- `email-marketing/studio/structure.ts`
- `email-marketing/studio/sanity.config.ts`

**Changes:**

- `structure.ts`: sidebar item label "Klaviyo" → "Resend". List query `*[_type == "klaviyoImport"]` → `*[_type == "espImport"]`. Title for the singleton "Sync / Import" stays.
- `sanity.config.ts`: `productionUrl` for `promotion`: `/api/preview/klaviyo/{id}` → `/api/preview/resend/{id}`. Imports for actions/badges updated to new component names + new plugin folder. Schema imports updated (`klaviyoImport` → `espImport`).

## Row 6 — Promotion approve/inspector copy

**Files:**

- `email-marketing/studio/plugins/promotion/documentActions/ApproveAction.tsx`
- `email-marketing/studio/plugins/promotion/documentActions/ResendAction.tsx` (note: this file is named `ResendAction` for "re-send"; do not rename even though it's now ironic — keep the name to avoid churn)
- `email-marketing/studio/plugins/promotion/inspector/PreviewStatusInspector.tsx`

**Changes:**

- `ApproveAction.tsx`: dialog message "Approve and send this promotion to Klaviyo?" → "Approve and send via Resend?"
- `PreviewStatusInspector.tsx`: status label "Delivered via Klaviyo" → "Delivered via Resend". If the inspector references a Klaviyo-render-accuracy concept, replace it with `"local-render"` or remove.

## Row 7 — Function: segment sync rewrite

**File:** `email-marketing/functions/import-klaviyo/index.ts` → `email-marketing/functions/import-resend-segments/index.ts`

**Rewrite:**

```ts
import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {Resend} from 'resend'

export const handler = documentEventHandler(async ({context, event}) => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[import-resend-segments] RESEND_API_KEY not set')
    return
  }
  const resend = new Resend(apiKey)
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})

  const importDocId = event.data._id

  await client.patch(importDocId).set({importState: 'importing'}).commit()

  try {
    const {data: segments = []} = await resend.segments.list()

    // For each segment, count contacts (paginate as needed).
    const segmentDocs = await Promise.all(
      segments.map(async (s) => {
        const {data: contacts = []} = await resend.contacts.list({segmentId: s.id})
        return {
          _type: 'segment',
          _id: `segment-${s.id}`,
          externalId: s.id,
          name: s.name,
          memberCount: contacts.length,
          isActive: true,
        }
      }),
    )

    // Upsert
    const tx = client.transaction()
    for (const doc of segmentDocs) {
      tx.createOrReplace(doc as any)
    }
    await tx.commit()

    // Delete stale
    const liveIds = new Set(segmentDocs.map((d) => d._id))
    const existing = await client.fetch<{_id: string}[]>(`*[_type == "segment"]{_id}`)
    const stale = existing.filter((d) => !liveIds.has(d._id)).map((d) => d._id)
    if (stale.length > 0) await client.delete(stale)

    await client
      .patch(importDocId)
      .set({
        importState: 'imported',
        lastImportedAt: new Date().toISOString(),
        segmentCount: segmentDocs.length,
        listCount: 0, // Resend has no separate List concept
      })
      .commit()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await client.patch(importDocId).set({importState: 'error', importErrorMessage: msg}).commit()
  }
})
```

**Notes:**

- Drop the rate-limiting logic (Klaviyo's 1/s for profile_count was Klaviyo-specific).
- Drop the v2025-07-15 revision header — Resend doesn't use one.
- **Use `createIfNotExists` + partial `patch().set(syncedFields)` to preserve the editable enrichment layer.** The example above uses `createOrReplace` for brevity but **that would clobber enrichment fields** (`affinityDescription`, `typicalCopyTone`, `engagementTier`). The original `import-klaviyo` function used the create-if-not-exists + partial-patch pattern; match that. Confirmed during the dogfood swap.
- The `description` field (Klaviyo segment definition) becomes empty/omitted since Resend has no equivalent.

## Row 8 — Function: scheduled segment sync rename

**File:** `email-marketing/functions/scheduled-import-klaviyo/index.ts` → `email-marketing/functions/scheduled-import-resend-segments/index.ts`

**Changes:**

- Filename + folder rename only.
- Inside: GROQ query `*[_type == "klaviyoImport"][0]` → `*[_type == "espImport"][0]`.
- Patch state: `klaviyoImport.importState` → `espImport.importState`.
- Logic unchanged.

## Row 9 — Function: send rewrite

**File:** `email-marketing/functions/on-promotion-approved/index.ts`

**This is the biggest change.** Read the current implementation in full first. Keep `buildHtml()` and `renderBlockHtml()` — those are HTML generators, ESP-agnostic.

**Replace the Klaviyo block (currently lines ~138–222) with:**

```ts
import {Resend} from 'resend'

// ... in handler ...

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL // e.g. "Brand <updates@example.com>"
if (!apiKey || !fromEmail) {
  console.error('[on-promotion-approved] RESEND_API_KEY or RESEND_FROM_EMAIL not set')
  return
}

const resend = new Resend(apiKey)
const html = buildHtml(promotion)
const label = `${promotion.campaignTitle ?? 'Campaign'} — ${promotion.segmentName ?? 'Base'} — ${Date.now()}`

const broadcast = await resend.broadcasts.create({
  segmentId: promotion.segmentExternalId ?? undefined,
  name: label,
  from: fromEmail,
  subject: promotion.subjectLine ?? '',
  previewText: promotion.preheader ?? undefined, // supported in SDK 6.x
  html,
})

if (!broadcast.data?.id) throw new Error('Failed to create Resend broadcast')

await resend.broadcasts.send(broadcast.data.id)

// Persist for webhook correlation
await client
  .patch(wfId)
  .set({status: 'sent', sentAt: new Date().toISOString()})
  .append('history', [
    {_key: `h-${Date.now()}`, _type: 'object', status: 'sent', timestamp: new Date().toISOString()},
  ])
  .commit()

// Also persist on the promotion itself (broadcast.id ↔ externalCampaignId for webhook correlation)
await client.patch(promotionRef).set({externalCampaignId: broadcast.data.id}).commit()
```

**Update merge tags inside `buildHtml()`:**

- `{{ unsubscribe_url }}` → `{{{RESEND_UNSUBSCRIBE_URL}}}` (two occurrences in current file: footer and default footer fallback).

**Don't:**

- Don't try to create a "template" first — Resend doesn't have stored templates.
- Don't pass `preheader` (Klaviyo name); use `previewText` (Resend name). Both refer to the same concept.

**Optional one-shot:** SDK 6.x supports `send: true` on `broadcasts.create` to fold create + send. The two-call pattern above is clearer when you need to persist the id between create and send. Pick one and document.

## Row 10 — Blueprint update

**File:** `email-marketing/sanity.blueprint.ts`

**Changes:**

- Function name `import-klaviyo` → `import-resend-segments`.
- Function name `scheduled-import-klaviyo` → `scheduled-import-resend-segments`.
- Delta filter `klaviyoImport.importState == "requested"` → `espImport.importState == "requested"`.
- Cron and robot token unchanged.
- Build paths (`functions/dist/...`) reflect renames.

## Row 11 — Frontend preview route rewrite

**File:** `email-marketing/frontend/app/api/preview/klaviyo/[id]/route.ts` → `email-marketing/frontend/app/api/preview/resend/[id]/route.ts`

**Changes:**

- Move file. Update Next.js route segment.
- Drop the create-template / call-render-API / delete-template flow.
- Render locally:

```ts
import {render} from '@react-email/render'

// ... fetch promotion, build HTML or React component ...
const html = await render(<PromotionEmail promotion={promotion} />)
return new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Preview-Status': 'local-render',
  },
})
```

If the existing route returns HTML built via the same `buildHtml` style as the function, you can keep that approach — Resend doesn't need a render call to produce HTML.

**Update the Studio `productionUrl`** referenced in row 5 to match the new route path.

## Row 12 — Frontend webhook rewrite (Svix)

**File:** `email-marketing/frontend/app/api/webhooks/engagement/route.ts`

**Changes:**

Replace the `verifyKlaviyoSignature` helper with Svix verification via the Resend SDK:

```ts
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()

  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers: {
        'svix-id': request.headers.get('svix-id') ?? '',
        'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
        'svix-signature': request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })
  } catch {
    return new Response('Unauthorized', {status: 401})
  }

  const event = JSON.parse(rawBody) as {
    type: string
    data: {broadcast_id?: string; email_id: string}
  }

  const broadcastId = event.data.broadcast_id
  if (!broadcastId) return new Response(null, {status: 200})

  const promotionId = await client.fetch(PROMOTION_BY_BROADCAST_QUERY, {id: broadcastId})
  if (!promotionId) return new Response(null, {status: 200})

  const current = await client.fetch(CURRENT_PERFORMANCE_QUERY, {id: promotionId})
  const performance = current ?? {openRate: 0, clickThroughRate: 0}

  if (event.type === 'email.opened') performance.openRate = (performance.openRate ?? 0) + 1
  else if (event.type === 'email.clicked')
    performance.clickThroughRate = (performance.clickThroughRate ?? 0) + 1
  // No conversionRate equivalent — see docs/ESP-NOTES.md

  await client.patch(promotionId).set({campaignPerformance: performance}).commit()
  return new Response(null, {status: 200})
}
```

The GROQ query name updates (`PROMOTION_BY_KLAVIYO_CAMPAIGN_QUERY` → `PROMOTION_BY_BROADCAST_QUERY`) but the query body — `*[_type == "promotion" && externalCampaignId == $id][0]._id` — is unchanged.

**Don't:**

- Don't try to import `svix` directly. The Resend SDK exposes verification — use it.
- Don't attempt to verify on parsed JSON. Raw body only.

## Row 13 — Env vars

**Files:**

- `email-marketing/frontend/.env.example`
- `email-marketing/frontend/.env` (local — already updated by orchestrator with `RESEND_API_KEY`)
- `email-marketing/.env` and `.env.example`
- README env table

**Changes:**

Replace the `KLAVIYO_API_KEY` block in `frontend/.env.example` with:

```
# Resend API key — required for the preview route and the engagement webhook
# Create at: resend.com → API Keys
RESEND_API_KEY=

# Resend webhook signing secret (Svix). Created when you register your webhook endpoint at:
# resend.com → Webhooks → Add Webhook
RESEND_WEBHOOK_SECRET=

# Verified sending domain `from` address (must be on a domain verified in Resend dashboard)
RESEND_FROM_EMAIL=
```

Function runtime env: not in `.env`. Document the commands users run after deploy:

```
npx sanity functions env add RESEND_API_KEY <key>
npx sanity functions env add RESEND_FROM_EMAIL "Brand <updates@example.com>"
```

## Row 14 — Render package

**File:** `email-marketing/packages/render-email/src/index.ts`

**Changes:**

- Rename export `renderPromotionKlaviyo` → `renderPromotion`.
- Replace merge tags: `{{ unsubscribe_url }}` → `{{{RESEND_UNSUBSCRIBE_URL}}}`.
- Rename helper `stubKlaviyoTags` → `stubResendTags` (or `stubMergeTags` — neutral). Update its tag-matching regex.
- Update all consumers in the repo (`functions/`, `frontend/`).

## Row 15 — Seed data

**File:** `email-marketing/studio/seed/*.ndjson`

**Changes:**

- `_type: "klaviyoImport"` → `_type: "espImport"` (also rename the `_id` if it's `klaviyoImport`-prefixed — keep singleton id stable; e.g. `espImport`).
- `externalId: "klaviyo-…"` → `externalId: "resend-…"` (or omit; the IDs are placeholder data).
- Any `description` text on segment seed docs that referenced Klaviyo — neutralize or remove.

## Row 16 — Docs and skills

**Files:**

- `email-marketing/README.md`
- `email-marketing/AGENT.md`
- `email-marketing/CLAUDE.md`
- `email-marketing/docs/ARCHITECTURE.md`
- `email-marketing/docs/ESP-NOTES.md` (new)
- `email-marketing/skills/klaviyo-integration/SKILL.md` (delete or replace with `resend-integration`)
- `email-marketing/skills/esp-connector-pattern/SKILL.md` (currently aspirational; reconcile with reality or delete)

**Changes:**

- Sweep all "Klaviyo" → "Resend" references for docs.
- README: env table, setup section, webhook setup section (Resend dashboard URLs).
- CLAUDE.md: "Email API: Klaviyo REST API" → "Email API: Resend REST API". Architecture notes about Klaviyo-specific behaviors (template lifecycle, render API) — replace with Resend equivalents.
- Create `docs/ESP-NOTES.md` summarizing Resend gaps from `references/klaviyo-to-resend-mapping.md`. Include guidance on how a user would wire `conversionRate` from an external event source if they need it.
- `skills/klaviyo-integration/`: delete the directory entirely OR rewrite as `skills/resend-integration/SKILL.md`.
- `skills/esp-connector-pattern/`: this skill describes a `@starter/esp-connector` package that doesn't exist in code. Two options: (a) delete it entirely; (b) rewrite to describe the actual pattern (Sanity Function calls Resend SDK directly, swap-skill for migration). **Default: delete.** Flag to orchestrator.

**Verify nothing references Klaviyo anywhere:**

```bash
grep -ri "klaviyo" email-marketing/ \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git \
  --exclude-dir=skills/swap-esp-resend
```

Expected output: zero matches.

## Order of execution (within a single agent's surface)

1. Schema rename first (row 2).
2. Then anything depending on schema names (rows 5, 7, 8, 10, 15).
3. Then component renames (rows 3, 4, 6).
4. Functions and route logic rewrites (rows 9, 11, 12).
5. Deps last (row 1) — actually run `pnpm install` once everything else is in place, or do it first if the agent wants type-checking during edits.
6. Docs (row 16) — last, capturing the as-built state.

## Files commonly missed (verified during dogfood swap)

These files don't fit cleanly into any single agent's surface and were missed by all 5 specialist agents during the parallel run. Audit them explicitly:

- `studio/scripts/bootstrap.ts` — Klaviyo API key prompt block, function names in setup messages, env var names. Sweep + add `RESEND_FROM_EMAIL` prompt.
- `studio/sanity.cli.ts` — typegen path globs reference function folder names.
- `studio/plugins/campaign/views/CampaignGridView.tsx` — preview URL path (`/api/preview/klaviyo/` → `/api/preview/resend/`).
- `studio/plugins/promotion/documentActions/ResendAction.tsx` — file is named for "re-send" workflow action; the _file name_ stays, but copy strings inside must be updated. Naming collision with Resend the company is unfortunate but renaming the file would create churn.
- `studio/schemaTypes/reference-data/segment.ts` — field titles/descriptions still say "Klaviyo". Drop the `behavioral` enum option from `type` (Resend Segments are static lists only).
- `package.json` (root of `email-marketing/`) — top-level `description` and `keywords`.
- `docs/TESTING.md`, `docs/SECURITY.md`, `docs/prd.md`, `docs/ARCHITECTURE.md` — historical docs need a sweep. The PRD especially: it describes an aspirational `@starter/esp-connector` package that was never built — add a top-level "Status note" rather than mechanically rewriting architecture claims.
- `e2e/tests/klaviyo/` directory — rename to `e2e/tests/esp/` and rewrite tests for the new architecture. Watch for: HMAC signing helpers (replace with Svix), Klaviyo-render iframe tests (replace with local-render fetch), `Placed Order` event tests (drop — no Resend equivalent).
- `skills/email-marketing-ops/SKILL.md` (or whatever the substantive ops skill is called) — full rewrite for Resend.

Add these to whichever agent's scope makes most sense, OR run a follow-up "cross-agent cleanup + AI Inspector audit" pass at the end. The orchestrator should plan for ~30 min of cleanup after the parallel agents finish.
