# Refactoring guidelines

The method that produced the north star. Follow it in order — most of the steps
exist because skipping one cost a rework.

Score the starter against `rubric.md` first — the scores are the backlog. The
conventions being refactored toward are the `starter` skill's
`references/map.md`; this file does not restate them.

## 1. Full-codebase audit before any move

Read **every** file and answer, per module: where is it used, why, is it
duplicated, is it reachable, and is there one composite change that fixes it in
many places at once. Fan out audit subagents per area and synthesise before
cutting a boundary. This is not a mechanical file-move.

The audit is where the value is. In the north star it found **8,842 LOC of
unreachable dashboard code** that the migration's own deletion inventory had
never counted — more than the planned deletion.

Verify before believing: exclude JSDoc example blocks from import counts, and
measure sizes rather than estimating them. Both mistakes sank headline claims in
the north star's design debate.

## 2. Adversarial clean-slate design for architecture forks

Any contested boundary — package cut, state ownership, where a loop lives — goes
through:

1. **Advocates** (2–3, parallel, fresh context, each championing a _distinct_
   approach named in its prompt). They argue as hard as the evidence allows and
   attack the alternatives.
2. **A judge** — fresh context, never an advocate, never the implementer. It
   verifies every load-bearing claim against the codebase and returns a scored
   verdict against stated criteria.
3. **A grill pass** on the winner (`mattpocock-skills:grilling`) until every
   branch of the decision tree resolves.

**A claim that fails verification scores against its author.** In the north
star's package-split debate each advocate lost at least one claim, including the
winner's own headline measurement, and in the learning-loop debate _both_
headline attacks failed — which is what produced the synthesis rather than a
winner. Anchors: `docs/decisions/adr-001-package-shape.md` and
`adr-002-learning-loop.md`, whose "Process" sections record exactly this.

None of these agents inherit the orchestrator's conclusions. Clean slate is the
point.

## 3. Bench-first for engine work

A workflow definition changes on the bench before it touches a dataset:
`createBench` from `@sanity/workflow-engine-test` runs the real engine in
memory with a deterministic clock and no network. Query the bench
(`bench.queryInScope()`) before theorising about behaviour.

Anchor: `agentic-localization/packages/l10n/src/workflows/localizeDocument.test.ts`
and its siblings. Engine behaviour the official docs do not cover lives under
"What the engine does not document" in
`agentic-localization/skills/sanity-l10n/references/extending.md` — read it
before writing a definition, and append to it when you learn something the hard
way.

## 4. Deletion is the deliverable

- Before the work: inventory what the change supersedes, **per file, with line
  counts**.
- Deletion ships in the PR that supersedes the code, never as a follow-up. A
  follow-up deletion PR does not get written.
- If a replacement leaves the old code's consumer without a state source,
  the deletion moves to the PR that re-sources the consumer — say so in the
  inventory rather than deleting into a broken build.
- A refactor whose diff is net-positive lines needs a reason in the PR body.

The north star deleted ~4,600 LOC of planned orchestration plus the 8,842 the
audit found; `CHANGELOG.md` carries the running total.

## 5. Visual flow verification for anything with a UI

Code gates do not catch wiring bugs. Type-correct, lint-clean, test-green code
that talks to the wrong dataset looks identical to code that works.

Drive the real app (`rnd:browser-vision`, or the `run` skill) through the flow
end to end and read the console and network panels. Definition-of-done for UI
work, not an optional extra.

Worked example: bulk translation failed with a `release.ref` error that no
suite caught — the workflow deployment declared only the workflows dataset, so
release refs minted against the content dataset had nowhere to resolve. The fix
was `resourceAliases` in `sanity.workflow.ts` plus `resourceClients` on the
engine (commit `a3158ce`), and the close condition on the ledger row was an
explicit **visual repro**, not a passing test.

## 6. Decision records

A ruling that fits on one line lands in `TODO.md` after the `→`. Anything larger
becomes `docs/decisions/adr-NNN-*.md` with: Decision · Drivers · Process (who
argued what, which claims failed) · Consequences, plus a "Resolved during
implementation" section appended as reality corrects the design.

Record the _reasoning chain and the losing options_, not just the outcome. The
purpose is to stop the question being re-litigated — cheap veto, no re-derivation.

## 7. Ledger discipline

`TODO.md` is updated in the same commit as the work. Rows are never deleted;
they are annotated with their ruling and marked `[~]` (ruled, queued) or `[x]`
(closed). Open rows that belong to the owner are stated as such. See the
`starter` skill's `references/map.md` §10.

## 8. One PR at a time, committed at green gates

- Work the sequence in order; never parallelise across the critical path.
  Parallelise only within a stage, with **disjoint file ownership**.
- Gates run before every commit:
  ```bash
  pnpm -r test
  pnpm -r typecheck        # pretypecheck regenerates typegen
  pnpm lint
  npx oxfmt --check .
  ```
  plus the stage's own gate (a deploy `--check`, an eval threshold, an e2e run).
- Commit each increment when its gates are green, without waiting for approval.
  Never push or publish without it.
- Separate commits for code and for docs.
- Self-review against the stage's invariants before reporting.

---

# The workflows-adoption playbook

Generalised from moving `agentic-localization` onto Sanity Editorial Workflows.
Use it for any starter whose orchestration should become engine-owned.

## Stage sequence

Each stage lands as its own PR and is green before the next begins.

| #   | Stage                   | Deliverable                                                                                                                                                                                                                                 | Gate                                                                                |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0   | **Platform floor**      | Studio v6 (the workflow Studio plugin needs 6.3+; there is no v5 path). Exact-pin the whole `@sanity/workflow-*` set in the catalog.                                                                                                        | existing suites green                                                               |
| 1   | **Definitions + bench** | The workflow definitions, alone, in a React-free package entry. No runtime yet.                                                                                                                                                             | the bench suite — this is the design gate                                           |
| 2   | **Dataset + deploy**    | A dedicated workflows dataset (blueprint resource), `sanity.workflow.ts`, deploy wired into bootstrap. First real contact; it surfaces deployment assumptions the bench cannot.                                                             | `sanity-workflows deploy --check`, then a real deploy and an empty `--dry-run` diff |
| 3   | **Handlers + runtime**  | One effect handler per effect name; the runtime Functions (drain, heartbeat, start, delete-handling) in the blueprint. Old Functions deleted here.                                                                                          | quality eval at its threshold                                                       |
| 4   | **Surfaces**            | Studio and dashboard re-sourced onto engine state via the engine's own hooks. No raw patches on instances.                                                                                                                                  | visual flow verification                                                            |
| 5   | **Deletions**           | The superseded pipelines, limiters, status vocabularies and schema fields, per the inventory.                                                                                                                                               | net-negative diff                                                                   |
| 6   | **Further tiers**       | Field-level or additional document types onto the same definitions. Prove the divergence (e.g. N children patching one array) on the bench first.                                                                                           | bench, then e2e                                                                     |
| 7   | **Agent entry point**   | Wire `@sanity/workflow-mcp` (same exact-pin set) so agents operate instances and author definitions through the same verbs and guards as the Studio and the Functions. **(target; not wired in the north star — do not cite as prior art)** | an agent completes a review journey on its own token                                |

Then, in order: package split → dedup audit → e2e → skills + evals → docs canon.
Split before docs so the docs describe the final shape.

**Entry-point checklist**, run at stages 4 and 7 — the workflow must be operable
by humans, automation _and_ agents, with no bypass for any of them (map §2):
each operator class reaches the same definitions through the same verbs; guards
hold identically for all three; and authority comes from the caller's token, not
from which surface called. A verb only one surface can reach is a design bug.

## The invariants pattern

Before the first stage, name the **seams that must not fork** and restate them
in every stage brief. An invariant is a sentence with a failure condition, not
an aspiration:

1. _`buildTranslateParams()` is the seam._ The handler and the eval call the
   same function. A diverging call path is a failed PR.
2. _Deletion ships with the PR that supersedes the code._
3. _Exact-version pins for the whole `@sanity/workflow-_` set; upgrade as one
   set, readers before writers.\*
4. _Instance state changes only through engine verbs_ — no raw patches.
5. _The node floor stays React- and Studio-free._ Check before adding an import.

Invariant 1 is the one that generalises hardest: find the function that makes
your starter's headline claim true, and pin every demonstrator to it. Without
it the eval suite stays green while proving nothing about production (rubric
§4).

## Portable engine facts

Behaviour the official docs do not cover — guard resolution, `idRefs`
single-document limits, advisory-only guards in the prerelease, workflow history
not being readable in conditions, at-least-once effect delivery and the
`effectKey` ledger, cross-dataset `resourceClients` — is written down in:

- `agentic-localization/skills/sanity-l10n/references/extending.md` §"What the
  engine does not document"
- `agentic-localization/skills/sanity-l10n/references/operating.md` (deploy
  order, reading a stuck run, failure triage)

Read both before writing a definition. Append to them when a stage teaches you
something; that file is the migration doc's permanent replacement.
