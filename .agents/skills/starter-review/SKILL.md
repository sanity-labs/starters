---
name: starter-review
description: 'Audit, score and de-slop a Sanity starter against the reference starter (agentic-localization). Use when reviewing a starter PR, auditing an existing starter, scoring one, planning or executing a refactor, or moving a starter onto a platform primitive such as Editorial Workflows. Covers the ten scored dimensions with their measuring commands, the enforcement tiers, and the proven refactoring sequence — full-codebase audit, adversarial design for architecture forks, bench-first, deletion as the deliverable, visual verification, decision records, green-gate commits. Trigger on: starter audit, audit a starter, refactor a starter, review a starter PR, score a starter, de-slop, starter rubric, is this starter conforming. For building or extending a starter — what the conventions ARE — use the starter skill instead.'
---

# Starter Review

Scoring and refactoring an existing starter. For what the conventions **are**,
load the sibling `starter` skill and its `references/map.md` — this skill does
not restate them.

`agentic-localization/` is the reference. Every "what good looks like" anchor
points there.

## Enforcement tiers

Every convention carries a tier, declared in `starter/references/map.md`:

| Tier         | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| **ENFORCED** | CI- or rubric-gated. Violating it fails a check or blocks a merge.    |
| **DEFAULT**  | Follow unless an ADR in the starter's `docs/decisions/` says why not. |
| **FREE**     | Per-starter choice. Not a finding.                                    |

The rubric's dimensions carry the same tiers, and the score maps to them:

- **0** — violated or absent · **1** — partial · **2** — conforming.
- A **0 on an ENFORCED dimension blocks the merge**, regardless of the total.
- A 0 or 1 on a DEFAULT dimension is a finding unless the starter has an ADR.
- FREE dimensions are not scored.

## Which reference

| Load                              | When                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `references/rubric.md`            | Reviewing a PR, or opening an audit. Ten dimensions, each with the command that measures it, the anchor file, and the slop signature. |
| `references/refactoring-guide.md` | Executing the fix. The eight-step method, plus the workflows-adoption playbook for moving a starter onto Editorial Workflows.         |

## The loop

1. Score with `references/rubric.md`. Record a table: dimension · tier · score ·
   evidence. **A dimension scored without a command or a `file:line` is not
   scored.**
2. The scores are the backlog. Order by tier, then by blast radius.
3. Execute with `references/refactoring-guide.md`, one PR at a time, committing
   at green gates.
4. Persist rulings as they land — one line in the starter's `TODO.md`, an ADR in
   `docs/decisions/` when it outgrows one line.
