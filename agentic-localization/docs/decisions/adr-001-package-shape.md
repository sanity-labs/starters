# ADR-001: Two packages on the React line; layers as export entries

Date: 2026-07-25 · Status: accepted

## Decision

`packages/l10n` splits into exactly two packages:

- **`@starter/l10n`** — the node floor. Zero React, zero `sanity` in its
  dependency graph. Entries are the layers of abstraction, each a deliberate
  contract: `.` (core primitives), `./prompts` (prompt assembly + queries +
  the eval suite), `./workflows` (definitions + engine coordinates),
  `./effects` (handlers + the effect-runtime toolkit — the extension surface
  for building custom workflows).
- **`@starter/l10n-studio`** — the sanity/React floor, depending on
  `@starter/l10n`. Entries: `.` (plugin, inspector, hooks, i18n),
  `./schemas` (content schemas + languageField).

Consumers: Functions, root configs, evals, and the SDK dashboard take
`@starter/l10n` only; the Studio takes both.

## Drivers

1. Owner criteria, in the order they were given: packages comprise the
   layers of abstraction; dependencies must support multiple environments,
   composable without cruft; the starter is a **reference** — developers and
   agents build their own translation workflows on these layers.
2. A package boundary is a contract with a consumer class, priced in
   manifests, versioning, and docs. The React line is the **only** boundary
   in this codebase where the install graph changes shape — `core` and
   `behaviors` were measured to have identical dependency blocks, as were
   `schemas` and `studio`. Boundaries that separate no dependencies are
   overhead in a template people clone to read.
3. Ecosystem precedent for the shape: `@tanstack/query-core` /
   `@tanstack/react-query`; `ai` / `@ai-sdk/react`; `@sanity/client` +
   `@sanity/types` vs `sanity` (with structure/router as entries within).

## Process

Three clean-slate advocates argued a layer cut, an adopter cut, and
refine-in-place; a fresh judge verified every load-bearing claim in the
codebase (each advocate lost at least one — including the winner's own
headline measurement), a grill pass found three inert-as-specified steps,
and the owner ruled twice: dependencies-per-environment as the deciding
criterion, then packages-where-a-consumer-class-exists as the framing.

Facts that decided it: all workspace packages are private and unpublished
(extraction is directory-copy, where manifests are baggage); the dashboard
carried three phantom devDeps purely to typecheck through a union manifest;
`getStatusDisplay` is dashboard-only and purifies to icon names, which is
what lets the dashboard stay node-only; `defineType`/`defineField` are
runtime exports of `@sanity/types`, letting the schemas drop their
full-Studio import.

## Consequences

- Every environment's manifest is cruft-free; `pnpm why react`/`sanity`
  from Functions or the dashboard shows no path through `@starter/l10n`
  (CI-gated).
- Boundaries are enforced three ways: the manifests themselves,
  `sideEffects: false` + a resolved-module-graph assertion test, and a lint
  zone banning Studio imports from the node package.
- Entry → package promotion is a `git mv` if anything is ever published —
  the discipline (explicit barrels, no deep imports) already exists.
- The prerelease `@sanity/workflow-*` pins split 1/3 across the two
  manifests; the workspace catalog keeps them in lockstep.
