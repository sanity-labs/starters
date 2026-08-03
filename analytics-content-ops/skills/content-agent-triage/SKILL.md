---
name: content-agent-triage
description: Automate content improvement with Content Agent (Agent Actions) safely. The queued → staged review pipeline, draft-as-review-gate pattern, instruction design, and the Content Release upgrade. Trigger on: content agent, agent actions, agent.action.generate, triage, agentReview, stale content refresh, SEO drafting, review queue.
---

# Content Agent Triage

Automate the "nightly catalog triage" journey: the sync flags underperforming
articles, and a scheduled Function uses Agent Actions to draft reasoning and
improved SEO — always into a **draft** a human approves. Nothing goes live
automatically.

## Core principle

**The draft is the review gate.** Every agent write lands in
`drafts.<id>`, never the published document. The ops lead reviews the "Content
Agent Queue" in Studio and publishes to approve. The agent only touches
editorial/SEO fields — never the read-only analytics signal.

## The state machine

`agentReview.status` on `article` drives the whole pipeline:

```
idle → queued → in_progress → staged → approved | dismissed
```

- **`queued`** — set by the sync (`runSync`) when an article _newly_ enters the
  `stale` tier and its review is idle/unset. Only idle reviews are touched, so
  in-flight work is never disturbed.
- **`in_progress`** — set by the triage Function as it starts an article.
- **`staged`** — set after the agent writes; the draft is ready for review.
- **`approved` / `dismissed`** — the human decision (publish or discard draft).

## The triage Function

`functions/agent-triage/index.ts` runs ~30 min after the sync (schedule in
`sanity.blueprint.ts`). Per run:

1. `QUEUED_QUERY` loads `agentReview.status == "queued"` articles, joining their
   `articlePerformance` tier / referrer / percentile as context.
2. For each: set `in_progress`, ensure a draft exists (copy published minus
   `_rev` into `drafts.<id>`), call `client.agent.action.generate`, then set
   `staged` + `releaseId` + `reviewedAt` on the draft.
3. On error, requeue (`status: 'queued'`) so the next run retries.

## Agent Actions setup

```typescript
// apiVersion "vX" is required for Agent Actions.
const client = createClient({projectId, dataset, token, apiVersion: 'vX', useCdn: false})

await client.agent.action.generate({
  schemaId, // 'default', or SANITY_SCHEMA_ID — must match the deployed schema
  documentId: draftId, // always the draft, never the published id
  instruction: INSTRUCTION, // uses $tier / $referrer / $percentile placeholders
  instructionParams: {
    tier: {type: 'constant', value: article.tier ?? 'stale'},
    referrer: {type: 'constant', value: article.referrer ?? 'organic'},
    percentile: {type: 'constant', value: String(article.percentile ?? 0)},
  },
  // Scope writes to exactly these fields — nothing else can change.
  target: [{path: 'agentReview.agentNotes'}, {path: 'seoTitle'}, {path: 'seoDescription'}],
})
```

### Safety layers (why this is trustworthy)

- **Scoped input** — the GROQ filter limits the agent to queued articles.
- **Scoped output** — `target` restricts writes to editorial/SEO fields.
- **Draft-only** — writes go to `drafts.<id>`; publishing is a human act.
- **Grounded instruction** — the prompt passes signal as read-only context and
  tells the agent to ground everything in the article's actual content, then
  optimize SEO for the article's top acquisition channel.

## Instruction design

The `INSTRUCTION` string channel-tailors the SEO advice: organic → search
intent/keywords; social → a scroll-stopping hook; email → narrative depth + CTA;
direct/referral → updated facts + internal linking. It asks for one reasoning
paragraph plus exactly three concrete improvement opportunities. Keep field
limits explicit (seoTitle ≤ 70 chars, seoDescription ≤ 160).

## Reviewing in Studio

`studio/structure.ts` defines the **Content Agent Queue** — articles with
`agentReview.status in ["queued", "in_progress", "staged"]`. Editors open a
staged article, read the agent notes in the `agentReview` object, compare the
drafted SEO, and publish (approve) or discard the draft (dismiss).

## Production upgrade: Content Releases

Each run currently tags staged drafts with a `releaseId`
(`stale-content-refresh-YYYY-MM-DD`). The documented upgrade is to promote this
batch to a first-class **Content Release** via the Releases API, so the whole
nightly triage can be reviewed and published atomically. See `AGENT.md`.

## References

- `functions/agent-triage/index.ts` — the triage Function
- `packages/@starter/analytics-sync/src/index.ts` — where articles get `queued`
- `studio/schemaTypes/article.ts` — `agentReview` object + status field
- `studio/structure.ts` — Content Agent Queue view
- `sanity.blueprint.ts` — schedule + env injection
