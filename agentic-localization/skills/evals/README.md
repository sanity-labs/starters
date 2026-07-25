# Skill evals

Evals for the two skills in `skills/`. Split by what they cost to run.

```sh
pnpm --filter @starter/skill-evals test   # deterministic — no project, no model, runs in CI
pnpm --filter @starter/skill-evals eval   # live grading through Agent Actions — consumes AI credits
```

The deterministic suite also runs under the repo's `pnpm test`.

They live outside both skill directories on purpose: a worker in the live suite is
handed the skill files verbatim, and expectations sitting inside those directories
would be handed over with them.

## What each suite measures

**`skills.test.ts`** — three properties that need no model.

- _Drift._ Every repo path a skill names, in a code span or a markdown link, still
  exists. Plus a list of paths that used to be real, which is what gets
  reintroduced from memory.
- _Coverage._ For each scenario, the files an agent would load actually name the
  file, entry or command the answer needs. A rubric can be argued with; a missing
  filename cannot.
- _Hygiene._ Frontmatter name matches the directory, the description carries a
  trigger surface with explicit negatives that name where a request belongs
  instead, references are reachable from SKILL.md, and no routing query leaks a
  skill name to the router.

**`routing.live.ts`** — description discriminability. Each query goes to the
grader with the skill roster and nothing else, which is all a real loader has.
Positives must land on their skill; at most one hard negative may be captured;
ambiguous cases are reported, not gated. Read the number as an upper bound — the
real loader may truncate or weight descriptions differently.

**`guidance.live.ts`** — whether the guidance lets an agent do the job. A worker
sees only the scenario prompt plus the skill files that scenario would load; a
grader that never saw those files scores the answer against anchored rubric
criteria. Between them, a deterministic check on whether the answer named the
right specifics.

## Cases

`cases/routing.json` — one query per line item, `kind` of `positive`, `negative`
or `ambiguous`. Negatives are near misses that share vocabulary: general i18n
modelling, UI-string translation, typegen, migrations, generic workflow gates.
`route` records where a negative belongs, for the reader; the grader never sees
it.

`cases/scenarios.json` — task scenarios across greenfield, brownfield,
extension, operate and frontend. `load` is the reference files an agent would
open, `mustName` the strings the answer has to land, `rubric` the criteria the
grader scores.

`roster.ts` — the two skills under test, read from their own frontmatter, plus
stand-ins for the ambient Sanity skills. The stand-ins are what give a hard
negative somewhere correct to go.

## Editing a skill

Run the deterministic suite on every edit; it is fast and catches path drift
immediately. Run the live suite after changing a description (routing) or cutting
guidance (coverage and rubric). A cut only stands if the scores hold.

Credentials for the live suite resolve the same way the translation evals'
do — `SANITY_AUTH_TOKEN` from `packages/l10n/.env`, or a `sanity login` session,
with the project and dataset from the repo root `.env`. `GRADER_TRIALS` raises the
draws per routing query when a verdict looks like noise.
