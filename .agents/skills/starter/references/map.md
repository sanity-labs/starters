# Map: the anatomy of a conforming starter

The north star is `agentic-localization/`. Every rule below is anchored to a file
there — read the anchor before writing the equivalent. Paths are relative to the
repo root.

Where a rule is ratified but not yet landed in the north star it is marked
**(target)**. Do not cite a target as prior art.

**Tiers.** Each section carries its enforcement tier — ENFORCED / DEFAULT / FREE,
defined in this skill's `SKILL.md`. Rows that differ from their section carry
their own tag. How a tier maps to an audit score is the `starter-review` skill.

## 1. Workspace shape — DEFAULT

A starter is a pnpm workspace whose packages are **dependency floors**, not
folders.

| Rule                                                                                                                                                      | Anchor                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Split packages on the line where the _install graph changes shape_ — usually React/Studio vs node. Boundaries that separate no dependencies are overhead. | `agentic-localization/docs/decisions/adr-001-package-shape.md`                                         |
| Layers of abstraction are **export entries**, not packages. An entry is a contract with a consumer class; deep imports are banned.                        | `agentic-localization/packages/l10n/package.json` (6 entries), `packages/l10n-studio/package.json` (2) |
| Packages are **source-only**: `exports` map to `./src/**/*.ts`, no build step, `sideEffects: false`. Consumers bundle.                                    | `agentic-localization/packages/l10n/package.json`                                                      |
| **[ENFORCED]** The floor is enforced three ways: manifests, a lint zone, and a resolved-module-graph assertion over each entry. Prose is not enforcement. | `agentic-localization/eslint.config.mjs` (`l10n/node-floor`), `packages/l10n/src/exports.test.ts`      |
| Peer pins that are declared but not imported carry a `"//dependencies"` note saying why. pnpm overrides do not reach auto-installed peers.                | `agentic-localization/packages/l10n-studio/package.json`                                               |
| Shared dep versions live in the `catalog:` block of `pnpm-workspace.yaml`, never in consumer manifests.                                                   | `agentic-localization/pnpm-workspace.yaml`                                                             |
| Prerelease families (`@sanity/workflow-*`) are pinned **exactly**, upgraded as one set, with the reason in a comment above the block.                     | same file                                                                                              |

Entry → package promotion is a `git mv` if anything is ever published. Do not
pre-split for a publication that may never happen.

## 2. Reference-architecture stance — DEFAULT

A starter is not a demo. It is a reference someone builds a complex system on.

- Each package's public API is an **extension surface**, not just a consumption
  surface. Export the tedious plumbing deliberately rather than keeping it
  private: `agentic-localization/packages/l10n/src/effects/index.ts` is the
  worked example (its header states the stance).
- The shipped implementations are _reference_ implementations; the spec suites
  are the reference for testing custom ones.
- Every capability the pattern needs gets a documented "write your own" path —
  a new definition, a new handler, a new locale, a new type.

**Multiple entry points.** An engine-adopting starter exposes the _same_ workflow
to three operator classes, not one:

| Operator   | Entry point                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Humans     | Studio and dashboard surfaces reading instance state through the engine's hooks                      |
| Automation | Functions runtime — event-triggered `startInstance` / drain / tick                                   |
| Agents     | `@sanity/workflow-mcp` — operate running instances and author definitions, registered in `.mcp.json` |

Same verbs, same guards, same definitions for all three. **Authority travels with
the token** — the operator-authority principle extended to non-human operators,
so an agent is constrained by exactly what its token may do, never by a
parallel permission model. Design the definitions so no entry point needs a
bypass.

## 3. Docs canon — DEFAULT

`docs/` holds exactly two things:

| Path                          | Job                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `docs/decisions/adr-NNN-*.md` | One ADR per load-bearing decision: Decision, Drivers, Process (who argued what, which claims failed verification), Consequences. |
| `docs/functions.md`           | Ops only — deploy, env, bundling rationale.                                                                                      |

The pattern narrative and the extension guide are **skill references**, not
`docs/` — an agent loads them by task, not by browsing:
`agentic-localization/skills/sanity-l10n/references/{pattern,adopting,extending,operating}.md`.

Hard rules:

- **Point, don't re-explain.** If official Sanity docs, a package README, or the
  code already says it, link it. Re-articulate only where no canonical source
  exists — then consider filing upstream.
- **[ENFORCED]** Every repo path a doc or skill names must exist. Gated by the
  drift suite in §4.
- Initiative scaffolding (migration handoffs, plans, state tables) is not a doc
  pattern. Retire it into ADRs + pointers when the initiative lands
  (`git show 02159ff` in the north star is the worked example).
- No `RESEARCH.md`-class files that nothing reads.
- The repo's `CONTRIBUTING.md` routes readers to `docs/decisions/` before they
  propose a structural change, so a settled question is not re-opened by someone
  who never saw the ADR.

## 4. Skills — DEFAULT

A starter ships skills that teach **the pattern**, not this repo.

- Scope: how the pattern works, what it requires, and how an agent adds it to a
  greenfield or brownfield project — plus an "extend it with your own" journey.
  Anchor: `agentic-localization/skills/sanity-l10n/SKILL.md`.
- The description carries an explicit trigger surface **and explicit negatives
  that name where a request belongs instead**. Same anchor.
- References are split by journey (`pattern` / `adopting` / `extending` /
  `operating`), loaded on demand from SKILL.md.
- **File references must survive `npx skills`.** A skill installed outside this
  repo cannot resolve repo-relative paths. Name the package and entry
  (`@starter/l10n/effects`) as the primary reference; give the in-repo path as
  the dual, and gate both with the drift test below.
  _Unresolved:_ the north star's skill uses repo paths throughout and its drift
  test enforces that they exist, which pulls against the package-relative
  primary. `agentic-localization/TODO.md` row 41 owns the reconciliation.
  Vendoring skills behind a lock file (as `conference-starter` does) is a
  pattern seen in the wild and **deliberately not adopted** here.
- **[ENFORCED]** **Skills ship with evals**, outside the skill directories (a
  live worker is handed the skill files verbatim; expectations inside would go
  with them): `agentic-localization/skills/evals/`. Three properties — drift
  (every path a skill names still exists, plus a list of paths that used to be
  real), coverage, hygiene — deterministic and in CI; routing and guidance
  graded live.

## 5. Tests — DEFAULT

Spec-driven: behaviour is proven by an executable spec before it ships.

| Layer                | Shape                                                                                                                                            | Anchor                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Unit                 | Sibling `*.test.ts` next to the module. Never a `__tests__/` dir.                                                                                | `agentic-localization/packages/l10n/src/core/*.test.ts`                     |
| Workflow definitions | `createBench` from `@sanity/workflow-engine-test` — real engine, in memory, deterministic clock, no project.                                     | `agentic-localization/packages/l10n/src/workflows/localizeDocument.test.ts` |
| Architecture         | Assertions over the resolved module graph, not greps over bundle text.                                                                           | `agentic-localization/packages/l10n/src/exports.test.ts`                    |
| e2e                  | Gherkin `.feature` files driven by racejar, against **dedicated throwaway datasets**, per-run tag + id-prefix isolation, nightly not per-commit. | `agentic-localization/e2e/` + its `.github/workflows/e2e.yml`               |
| AI quality           | Live-model evals gated on **sampled aggregates**, never a single draw.                                                                           | `agentic-localization/packages/l10n/src/prompts/evals/model-scoring.ts`     |
| Skills               | See §4.                                                                                                                                          | `agentic-localization/skills/evals/`                                        |

**[ENFORCED]** Every suite that is deliberately narrow keeps an honest
**not-covered list** in its README. `agentic-localization/e2e/README.md` is the
model: "a green suite that is quietly narrow is worse than a missing one."

## 6. CI — ENFORCED

Two tiers, and they are not interchangeable:

- **Root `.github/workflows/ci.yml`** is the only thing GitHub executes in this
  monorepo. One job per starter, `working-directory` scoped. If a check is not
  here, it does not gate.
- **`<starter>/.github/workflows/*.yml`** exist for the cloned-standalone life
  after `sanity init --template`. They never run in this repo. Anything that
  must gate here has to be mirrored into the root file.

Rules a job must satisfy:

- Every artefact a check reads is **produced earlier in the same job**. The
  bundle-size gate is preceded by the build; without it the `for` loop matches
  nothing and the check is silently green. Anchor: root `ci.yml`, the
  `agentic-localization` job's "Build functions" → "Check function bundle sizes"
  pair (its comment records the bug).
- Thresholds are ratchets over the current worst measurement, with the number
  and its subject named in a comment.
- Secrets come from a per-starter `environment:`; a job that references an
  absent secret fails informatively rather than skipping.
- Starter lock files are gitignored, so a job must not use
  `--frozen-lockfile`. Nested workflows that do are a trap waiting for the first
  clone.
- Config the platform reads only from the repo root (`renovate.json`, workflow
  files) must be at the repo root. Nested copies are dead files.
- Green CI means nothing without **required status checks** on the branch
  ruleset — that is a repo-settings task, not a file, and it belongs on the
  owner checklist.

## 7. Tooling

| Concern         | Tier     | Rule                                                                                                                                                                                                                                     |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format          | ENFORCED | `oxfmt`, config in `.oxfmtrc.json`: `semi: false`, `singleQuote: true`, `printWidth: 100`, `bracketSpacing: false`. Gate with `npx oxfmt --check .`.                                                                                     |
| Lint            | DEFAULT  | oxlint extending `@sanity/plugin-kit/oxlint` via `extends` — never copy-paste the preset. **(target; the north star is still on `eslint.config.mjs`)**                                                                                   |
| Engines         | DEFAULT  | `>=22.18` **(target; north star declares `>=22.12`)**                                                                                                                                                                                    |
| Plugin packages | DEFAULT  | A Studio plugin package follows `@sanity/plugin-kit` canon including verify-package conformance. Where conformance fights the source-only workspace pattern, record the exception as an ADR rather than silently diverging. **(target)** |
| Typegen         | DEFAULT  | `typegen` block in `studio/sanity.cli.ts`, output into a types package, generated + gitignored, with `pretypecheck` regenerating. A committed artefact hides a broken config.                                                            |

## 8. Env cascade — DEFAULT

`sanity init --template` writes credentials into a workspace directory, but a
starter wants one root `.env.local`. Each workspace entrypoint therefore loads
both, highest priority first, and tolerates absence:

```ts
for (const dir of [__dirname, `${__dirname}/..`]) {
  for (const suffix of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(`${dir}/${suffix}`)
    } catch {}
  }
}
```

Anchors: `agentic-localization/studio/sanity.cli.ts`,
`apps/translations-dashboard/sanity.cli.ts`, `apps/frontend/next.config.ts`.

Exception: files loaded by **jiti** (`sanity.blueprint.ts`, `sanity.workflow.ts`)
have no `process.loadEnvFile` — parse `.env` manually. Anchor:
`agentic-localization/sanity.blueprint.ts`.

**[ENFORCED]** Committed `.env` carries non-secret prefix mappings only;
`.env.example` is the template; `.env.local` is gitignored.

## 9. Blueprint — DEFAULT

Infrastructure the starter needs is declared, not scripted:
`agentic-localization/sanity.blueprint.ts`. FREE for a starter that deploys no
Functions and owns no datasets.

- One `defineDataset` per dataset the stack owns, `aclMode: 'private'`,
  `deletionPolicy: 'retain'`. Pre-existing datasets get `ownershipAction:
{type: 'attach'}`; datasets the stack creates do not.
- Function event filters and env are derived from **exported constants**, not
  string literals (`APPROVED_STAGE`, `WORKFLOW_TAG`, `WORKFLOWS_DATASET` from
  `@starter/l10n/workflows`). A literal on either side only fails at runtime.
- Robot tokens referenced via `$.resources.<name>`.

## 10. The TODO.md ledger — DEFAULT

`agentic-localization/TODO.md` is the convention, not an artefact of one
project. One line per open question, owner-voiced, with the **ruling appended
after `→`** when it is decided:

```
[~] - oxlint → RATIFIED (2026-07-25): pure oxlint extending @sanity/plugin-kit/oxlint …
[x] - can `migrations` get deleted now? → no: seed-locales is a live bootstrap step …
```

`[ ]` open · `[~]` ruled, execution queued · `[x]` closed. A question is never
deleted — a closed row with its ruling is the cheapest decision record there is,
and rows that outgrow one line graduate to `docs/decisions/`. Update the ledger
in the same commit as the work, not after.

## 11. FREE — per-starter, not findings

Frontend framework and app shape · styling and component library · the content
model itself · sample-data strategy · which apps exist beyond `studio/` ·
additional workspace packages · dev-server ports · the domain skill's subject
matter. Do not open a finding against any of these; a starter differs from the
north star here by design.
