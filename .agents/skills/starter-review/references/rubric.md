# Rubric: scoring a starter

Ten dimensions, each tagged with its enforcement tier. Tiers, the 0/1/2 scale
and what blocks a merge are defined in this skill's `SKILL.md`; the conventions
themselves live in the `starter` skill's `references/map.md`, cited per
dimension as the anchor.

Run from the starter directory unless a command says otherwise. Record the score
as a table in the PR or audit report — dimension · tier · score · evidence.

The two **ENFORCED** dimensions are Demo integrity (§4) and Test reality (§7):
both make every other dimension unfalsifiable, so a 0 blocks. CI reality (§9)
and Docs drift (§6) are DEFAULT as dimensions, but several ENFORCED conventions
sit inside them (map §3, §4, §6) and each fails on its own.

---

## 1. Orchestration — DEFAULT

**Question** — is fan-out, retry, concurrency, status and idempotency owned by a
platform primitive, or re-implemented?

**Measure**

```bash
grep -rniE "semaphore|inFlight|concurrency|maxConcurrent|Reducer\b" --include='*.ts' --include='*.tsx' . | grep -v node_modules
grep -rnE "^\s*(export )?(const|type) [A-Za-z]*(Status|State) = \{|'idle' \| 'pending'" --include='*.ts' . | grep -v node_modules
grep -rn "setTimeout\|Date.now() -" --include='*.ts' . | grep -v node_modules   # time-window idempotency
```

**Good** — orchestration is a declarative definition proven on a bench;
runtime code is handlers.
`agentic-localization/packages/l10n/src/workflows/localizeDocument.ts` +
`localizeDocument.test.ts`; handlers in `packages/l10n/src/effects/`; the rule
written down in `agentic-localization/AGENT.md` ("Orchestration belongs to the
workflow engine").

**Slop signature** — a hand-rolled semaphore with a magic limit; more than one
status vocabulary for the same run; a "is this stale yet" cache; a `for` loop
over locales/items in a React hook; a five-minute time window as the only
idempotency; a manual retry button. The north star had all six before the
migration.

---

## 2. Dependency hygiene per environment — DEFAULT

**Question** — does every deployed environment install only what it runs?

**Measure**

```bash
pnpm why react --filter <function-or-node-consumer>     # expect: no path
pnpm why sanity --filter <function-or-node-consumer>    # expect: no path
pnpm --filter <pkg> test                                # the module-graph assertion
grep -rn '"catalog:"' packages/*/package.json | wc -l   # shared versions centralised?
```

Then, per manifest: for each declared dependency, `grep -rn "from '<dep>'" src/`
— zero hits means it is either dead or an undeclared-peer pin, and the manifest
must say which.

**Good** — `agentic-localization/packages/l10n/package.json` (node floor, zero
react/sanity) enforced by `packages/l10n/src/exports.test.ts` and the
`packages/l10n/src/**` zone in `oxlint.config.ts`; peer-pin-only deps annotated in
`packages/l10n-studio/package.json`'s `"//dependencies"`.

**Slop signature** — phantom devDeps added to make a union manifest typecheck; a
frontend or Function whose install graph reaches the Studio; `overrides` in
`package.json` instead of `pnpm-workspace.yaml`; version drift between two
manifests naming the same package.

---

## 3. Dead code — DEFAULT

**Question** — is every module reachable from a declared entry, a test, or a
deployed artefact?

**Measure** — for each exported symbol, `grep -rn "\b<symbol>\b" --include='*.ts'
--include='*.tsx' . | grep -v node_modules | grep -v <its own file>`. Do this per
directory, not per hunch. Exclude JSDoc example blocks by hand — a debate
advocate in the north star lost a headline claim to three "imports" that were
comments.

**Good** — the north star's split shipped after an audit that found **8,842 LOC
of unreachable dashboard code the migration inventory never counted**. Explicit
barrels (`packages/l10n/src/*/index.ts`) make the reachable set enumerable.

**Slop signature** — barrels re-exporting symbols nobody imports; two names for
one constant (`LOCALIZATION_WORKFLOW_DATASET` aliasing `WORKFLOWS_DATASET`);
a `migrations/` or `lib/` folder no script calls; components superseded by a
rebuild but left in place "for reference".

---

## 4. Demo integrity — ENFORCED (gate)

**Question** — is the starter's headline claim exercised by the code path
production actually takes?

**Measure** — name the claim in one sentence. Find the function that makes it
true. Then:

```bash
grep -rn "<thatFunction>" --include='*.ts' --include='*.tsx' . | grep -v node_modules
```

Every consumer that demonstrates the claim — handler, eval, e2e, demo page —
must appear in that list. If the eval builds its own version of what the
runtime builds, the claim is decorative.

**Good** — `buildTranslateParams()`
(`agentic-localization/packages/l10n/src/prompts/promptAssembly.ts`) is a named
invariant: the production handler
(`packages/l10n/src/effects/translateLocale.ts`) and the eval
(`packages/l10n/src/prompts/evals/translate.ts`) call the _same_ function. A
diverging call path is a failed PR — otherwise the eval suite passes while
proving nothing about production, and the quality claim silently decouples from
the runtime.

**Slop signature** — an eval, benchmark or demo that reconstructs the prompt,
the query, or the request its runtime counterpart builds; a README claim whose
only proof is a screenshot; a "smart" feature whose only caller is a test.

---

## 5. Upstream dedup — DEFAULT

**Question** — does any first-party module replicate, or hand-roll what could
come from, a Sanity-managed package?

**Measure** — per capability (id handling, asset URLs, path walking, diffing,
NDJSON, unicode sanitising, status display…): search `sanity-io` and
`sanity-labs` with `mcp__github__search_code`, plus the npm `@sanity` scope.
Never conclude absence from memory; installed `.d.ts` files are ground truth for
the resolved version. Discard hits in vendored copies of the starter itself.

**Good** — adopt-by-default: `agentic-localization/packages/l10n/package.json`
takes `@sanity/diff`, `@sanity/id-utils`, `@sanity/asset-utils`, `@sanity/util`
and deletes the first-party equivalents (commits `19cc6ca`, `8707c36`). A
first-party version survives only as a **stated exception** — bundle floor,
prerelease instability, or genuine unfitness — written down where the code is.

**Slop signature** — a local `getDocumentId`/`slugify`/`isRecord` next to an
installed package that exports it; a hand-rolled diff; a helper whose docstring
describes a Content Lake error the platform package already handles.

---

## 6. Docs drift — DEFAULT

**Question** — do the docs describe the code that exists, and do they point at
canonical sources instead of restating them?

**Measure**

```bash
pnpm --filter <skill-evals-pkg> test    # the drift suite: every path a doc/skill names must exist
grep -rnoE '`[a-zA-Z0-9_./@-]+\.(ts|tsx|md|json|yaml)`' *.md docs/ skills/ | \
  awk -F'`' '{print $2}' | sort -u | while read p; do [ -e "$p" ] || echo "MISSING $p"; done
```

Then read for restatement: any paragraph explaining a Sanity API that
`sanity.io/docs` already explains is a pointer waiting to happen.

**Good** — `agentic-localization/skills/evals/skills.test.ts` fails on a named
path that no longer exists **and** on a list of paths that used to be real (the
ones an agent reintroduces from memory). ADRs record why, not what:
`docs/decisions/adr-001-package-shape.md`.

**Slop signature** — a doc naming a deleted file; a `docs/` page re-teaching
GROQ or Content Releases; migration/plan scaffolding left in `docs/` after the
migration landed; two files describing the same subsystem differently.

---

## 7. Test reality — ENFORCED (gate)

**Question** — do the gates gate, and is anything silently green?

**Measure**

```bash
pnpm test               # then break one invariant on purpose and confirm it goes red
grep -rn "skip\|todo\|it.only\|describe.only" --include='*.test.ts' . | grep -v node_modules
```

For every check that iterates over produced files (bundles, dist, generated
types), confirm the producer runs first in the same job. For every live-model
assertion, confirm it samples more than once.

**Good** — sampled aggregates with the noise measured and written down
(`agentic-localization/packages/l10n/src/prompts/evals/model-scoring.ts`); an
honest not-covered list in `agentic-localization/e2e/README.md`; a
module-graph assertion that reads `moduleIds` rather than grepping minified
output (`packages/l10n/src/exports.test.ts` documents why the grep would lie).

**Slop signature** — a size or lint loop over a directory that CI never
populates; a live-model gate on a single draw; a suite whose README implies
coverage it does not have; assertions on mocks of internal state.

---

## 8. Plugin-kit conformance — DEFAULT (target)

**Question** — does a Studio plugin package follow `@sanity/plugin-kit` canon?

**Measure**

```bash
grep -rn "@sanity/plugin-kit" package.json */package.json packages/*/package.json oxlint.config.ts .oxlintrc.json 2>/dev/null
npx @sanity/plugin-kit verify-package    # from the plugin package
```

The lint preset must arrive via `extends`, not a copied rule list.

**Good** — `agentic-localization/oxlint.config.ts` extends
`@sanity/plugin-kit/oxlint` and pins the preset exactly. verify-package
conformance for `packages/l10n-studio` is still open: the checks assume a
published, pkg-utils-built plugin, and a source-only workspace package fails
five of them. Conformance gaps that fight the source-only workspace pattern are
surfaced as an ADR, not silently ignored.

**Slop signature** — a copy-pasted rule list drifting from the preset; a plugin
package with no `sanity.json`/plugin metadata and no recorded exception; per-
starter lint configs that disagree.

---

## 9. CI reality — DEFAULT

**Question** — would this configuration actually catch a regression?

**Measure**

```bash
cat ../.github/workflows/ci.yml | grep -n "working-directory\|name:"   # is this starter a job at all?
ls .github/workflows/                                                   # nested = standalone-only, never runs here
gh api repos/:owner/:repo/rulesets                                      # required checks configured?
```

Read each job top to bottom and ask, per step, what file it reads and which
earlier step wrote it.

**Good** — the `agentic-localization` job in the root `.github/workflows/ci.yml`:
format, lint, typecheck, test, template validate, manifest extract, **build
functions, then** the bundle ratchet whose comment records that the check
previously matched nothing.

**Slop signature** — a starter with no root job (`email-marketing` ships a
`.github/workflows/ci.yml` that GitHub never reads); a bundle gate with no build
(`knowledge-base`'s job); `pnpm dlx` instead of a pinned devDep
(`ai-shopping-assistant`); a `renovate.json` nested inside a starter where the
app never looks; a red default branch nobody notices because no check is
required.

---

## 10. Bootstrap reality — DEFAULT

**Question** — does a clean `sanity init --template` clone reach a working app
without tribal knowledge?

**Measure** — clone into a fresh directory, `pnpm install && pnpm bootstrap &&
pnpm dev`, with only `.env.example` for guidance. Every step that fails or needs
an undocumented answer is a finding. Confirm each entrypoint tolerates env in
_either_ the workspace or the root.

**Good** — the two-directory / two-suffix cascade in
`agentic-localization/studio/sanity.cli.ts`, mirrored in
`apps/frontend/next.config.ts` and the manual jiti parse in
`sanity.blueprint.ts`; infrastructure declared in the blueprint rather than
listed as README prose.

**Slop signature** — a README with manual `sanity dataset create` steps the
blueprint could declare; env vars read under one name in code and another in CI;
`process.loadEnvFile` in a jiti-loaded config; a bootstrap whose steps were each
verified but never run end to end on a clean project (the north star's own
honest `[~]` at `TODO.md` row 27).
