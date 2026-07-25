# `@starter/e2e`

Critical user journeys as Gherkin, driven by [racejar](https://www.npmjs.com/package/racejar)
against a **real project**: real datasets, the deployed definitions, the real
engine, real Content Lake guards, and the publish and delete Functions themselves.

The bench suite (`packages/l10n/src/workflows/*.test.ts`) proves the definitions
in memory. This proves the parts a bench cannot: that the definitions deploy,
that a publish event opens a run, that the effect handlers write what they claim,
and that the engine's guards land in the lake.

## Prerequisites

Two datasets, isolated from `production`:

| Env var                        | Default         | Holds                       |
| ------------------------------ | --------------- | --------------------------- |
| `SANITY_E2E_CONTENT_DATASET`   | `e2e`           | Articles, profiles, locales |
| `SANITY_E2E_WORKFLOWS_DATASET` | `workflows-e2e` | Definitions and instances   |

The suite creates them on first run if the token may; otherwise it says exactly
which `sanity dataset create` to run. `SANITY_STUDIO_PROJECT_ID` comes from the
starter root `.env`; the token from `SANITY_AUTH_TOKEN` (`e2e/.env` — copy
`.env.example`) or a local `sanity login` session.

Nothing is deployed first — no schema, no blueprint, no `sanity-workflows deploy`.
The suite deploys the definitions itself, under a per-run tag.

## Running

```bash
pnpm e2e                       # from the starter root
pnpm --filter @starter/e2e e2e  # the same thing
```

Deliberately **not** wired to `pnpm test`: CI has no project credentials. The
nightly `.github/workflows/e2e.yml` is the scheduled caller.

## The three drive modes

Every mode runs the real engine against the real lake. They differ in how far
down the stack the run actually goes.

| Mode  | Effects                                               | Proves                                                                     | AI spend         |
| ----- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| **P** | none; the harness completes each with a handler's ops | Definitions, cohort gates, guards, review decisions, the Functions         | none             |
| **H** | the real handlers, Agent Actions canned               | Write paths — what lands where, at which revision, and what is not created | none             |
| **F** | the real handlers, live Agent Actions                 | Nothing the others do; only that the live API still answers                | real, per locale |

Mode F is not implemented. Modes P and H are what run nightly.

## Isolation

- A per-run engine **tag** (`e2e-<8 hex>`) partitions the definitions and
  instances; teardown deletes the whole partition.
- Per-run document ids (`e2e-run-<runId>-…`) are swept by prefix. Locale fixtures
  are shared (`e2e-fixture-…`) because the analysis handler reads them by type.
- A run that dies mid-flight leaves lake guards holding a publish lock. `globalSetup`
  sweeps litter older than two hours, which is why the datasets are throwaway.
- An assertion that reads by TYPE rather than by id ("no sibling was created")
  cannot be isolated by prefix, so the journey that makes one empties those types
  first. Another reason the datasets belong to the suite alone.

A scenario takes 15–100s and the whole suite about 17 minutes: every step is real
API round trips, and the engine's verbs are sequential by design. That is why
this is nightly rather than per-commit.

## What this does NOT cover

Being explicit, because a green suite that is quietly narrow is worse than a
missing one:

- **No browser.** Nothing here exercises the Studio inspector, the document
  actions, the release picker, or the dashboard. Those are `racejar/playwright`
  journeys, not written yet.
- **No deployed Functions.** The handlers are imported and called with a
  synthesized event envelope. The blueprint's filters, projections, robot token
  and timeouts are not exercised — a publish event that the platform would never
  route still gets delivered here.
- **Mode H drains through the harness's engine, not `functions/drain-effects`.**
  The Agent Actions seam is `createEngine({resourceClients})`, which that Function
  does not expose. Its ten lines of glue are covered by unit tests instead, and
  `heartbeat`'s stale-claim sweep is not exercised at all.
- **No live model.** Translation quality is the eval suite's job
  (`pnpm --filter @starter/l10n eval`), not this one.
- **No campaign or release journeys.** `localize-campaign`, `publish-release` and
  the version write path are unproven end to end (J4/J5).
- **Guards are asserted through the engine's registry**, not by attempting a
  mutation the lake should deny.
- **Document-tier writes are unproven.** Mode H covers the field tier only; the
  sibling-document + `translation.metadata` path has no canned translate answer yet.
