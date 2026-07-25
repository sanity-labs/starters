# ADR-002: The learning loop is a content-native observer with engine-captured revisions

Date: 2026-07-25 · Status: accepted — built (`packages/l10n/src/distill/`,
`functions/distill-review/`)

## Decision

The self-reinforcing loop ("use generates context") is an **observer of
finished runs**, not a phase of them:

- **Capture (shipped)**: `localize-locale` carries `machineRev` — the
  revision at which the machine translation was written, recorded as a
  completion op at translate time, the one moment machine output is
  unambiguous. Write-only until the loop lands; every completed run banks
  trainable history.
- **Distill (after e2e)**: a `distill-review` Sanity Function triggered by
  instances reaching the `approved` stage (blueprint event filter on the
  workflows dataset — the drain-effects pattern). It diffs the machine draft
  (`machineRev` via the History API) against the human-approved text, runs a
  pure noise gate before any AI spend, makes one prompt call per run, and
  writes **draft** `l10n.proposal` documents. Idempotent via a deterministic
  claim document (the `start-localization` sha-id pattern), swept on a
  retention cadence.
- **Propose, never decide**: humans accept proposals via a document action
  that patches the target glossary/style-guide _draft_; prompt assembly
  reads only published, `approved`-status context, so nothing automation
  writes can reach a prompt without two human acts (accept + publish).

## Drivers

Locked principles: automation proposes, never decides; surface, never
block; instance owns workflow state, content owns content state; the
starter is a reference — the loop must be deletable as one directory (three
steps, the documented Functions add/remove path).

## Process and the deciding facts

Two clean-slate advocates (engine-native detached child vs content-native
observer) and a verifying judge. Both headline attacks failed verification:
the engine-native side's backpressure claim was equally true of both
designs, and the content-native side's "no definition change" claim was
false — its History-API bracketing (`ranAt + durationMs`) was uncomputable
(`durationMs` is never written; `ranAt` stamps at completion, not
dispatch). The synthesis takes the observer with the engine-native side's
one indispensable idea: `machineRev`.

Safety findings that became hard rules with tests: a `provisional`
do-not-translate glossary entry bypasses the status filter and reaches
`protectedPhrases` (fixed); `coalesce(status, "approved")` treats status-less
entries as approved, so the Accept action must always write an explicit
status; the drafts-invisible guarantee rests on the client's default
perspective and is made explicit at the handler read.

Open items resolved by the grill: campaign runs write release versions, not
drafts — the gatherer must handle version ids or exclude release-scoped
runs (design before implementation); the Function needs the content-dataset
name in its blueprint env; claim documents live in the content dataset (the
Studio surface requires it); `distill-review` is excluded from the e2e
stack so journeys don't spend AI per test run — superseded in
implementation, see the last item below.

## Consequences

- The core localization definitions stay minimal; the loop's failure budget
  never touches the run lifecycle (cost: weaker failure surfacing — a log
  line and a failed claim doc, not a stage; accepted for the starter).
- Eval cases harvest as coordinates (`locale, targetId, targetRev,
sourceRev`), materialized into fixtures by a script; approved runs with
  zero human edits are free deterministic eval cases.
- The qualityDelta trend across the growing harvested corpus is the loop's
  health metric.

## Resolved during implementation

- **Accepting an eval case publishes it.** The other two kinds are appended to a
  glossary or style-guide draft and the proposal is deleted, but an eval case has
  no target — its value _is_ its coordinates. Publishing is what tells the
  fixture script a harvested case from one awaiting review, and Reject still
  deletes. The ADR left this unstated.
- **One eval case per clean locale**, not one per run: the coordinates are
  per-locale, so per-run has no shape to be written in.
- **The changed-word ratio is over both sides' word counts.** Added + removed
  over `machine + human` words, so a same-length wholesale swap is 1.0 and a
  one-word fix in a sentence is a small fraction. Over the longer side alone, a
  full swap scores 2.0 and every rewrite-plus-correction pair would be
  misclassified as style-only.
- **A non-404 History failure is not `history-unavailable`.** Swallowing every
  error would report a bad token as "nothing to learn" — the silence that makes a
  dead loop look healthy. Only 404 degrades.
- **The Function needs one injectable dependency, so the e2e stack keeps it.**
  The loop makes an Agent Actions call, so the e2e suite must own its content
  client; `createDistillHandler(clientFor)` takes it and `handler` is the
  production wiring. The deployed artifact has no test-only branch — and with
  that seam the journeys drive the real handler rather than excluding it.
