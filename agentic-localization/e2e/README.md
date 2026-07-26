# `@starter/e2e`

Critical user journeys as Gherkin, driven by [racejar](https://www.npmjs.com/package/racejar)
against a **real project**: real datasets, the deployed definitions, the real
engine, real Content Lake guards, and the publish, delete and distill Functions
themselves.

Two layers, two vitest projects, invoked independently:

| Project   | Location    | Drives                                | Needs                       | Runtime |
| --------- | ----------- | ------------------------------------- | --------------------------- | ------- |
| `api`     | `features/` | The engine and the handlers, headless | The e2e dataset pair        | ~22 min |
| `browser` | `browser/`  | The running Studio and dashboard      | `pnpm dev`, the dev dataset | ~1 min  |

## The API journeys

The bench suite (`packages/l10n/src/workflows/*.test.ts`) proves the definitions
in memory. This proves the parts a bench cannot: that the definitions deploy,
that a publish event opens a run, that the effect handlers write what they claim,
that the engine's guards land in the lake, and that the learning loop can read
back a machine revision the handlers wrote minutes earlier.

| Journey               | Mode | Proves                                                           |
| --------------------- | ---- | ---------------------------------------------------------------- |
| `publish-to-approved` | P    | The happy path, the cohort gate, the publish hold                |
| `request-changes`     | P    | A narrowed re-run, and that it does not narrow the next pass     |
| `partial-failure`     | P    | A failed locale is surfaced, not blocking                        |
| `field-tier-person`   | H    | In-place write paths, the published read perspective, no restart |
| `distill-review`      | H    | The learning loop: proposals, free eval cases, claim idempotency |

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
pnpm e2e          # the API journeys, from the starter root
pnpm e2e:browser  # the browser journeys — needs `pnpm dev` running
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

A scenario takes 15–100s and the whole suite around 22 minutes: every step is real
API round trips, and the engine's verbs are sequential by design. That is why
this is nightly rather than per-commit.

## The browser journeys

```bash
pnpm dev          # Studio :3333, dashboard :3334
pnpm e2e:browser
```

| Journey                | Surface                | Proves                                                              |
| ---------------------- | ---------------------- | ------------------------------------------------------------------- |
| `studio-review`        | Article, document tier | The inspector opens, the grid states, deferred diffs, sibling panes |
| `studio-inbox`         | Localization structure | Four sections, and that a section's count equals its rows           |
| `field-tier-inspector` | Profile, field tier    | One column per internationalized field, a state per cell            |
| `dashboard`            | `:3334`                | Nothing yet — see the tags below                                    |

These read the **dev** dataset the dev servers are already serving and write
nothing to it — the one exception, the review-verb scenarios, mutates a run and
stays skipped unless `E2E_BROWSER_VERBS=1` opts in. Screenshots land in
`/tmp/l10n-shots/e2e-browser` (`L10N_SHOTS_DIR` to move them).

### racejar on vitest, driving Playwright as a library

Gherkin is the house format, so the browser layer is racejar too — but on the
**vitest** driver, with Playwright imported as a plain library rather than
through `@playwright/test`. `racejar/playwright` would be the obvious choice and
does not work: its driver registers each scenario with a non-destructured first
parameter, which current `@playwright/test` rejects, so the file collects **zero
tests** and reports green. Filed upstream; until it lands, `racejar/vitest`
hosting a Chromium that steps share through the per-scenario context is the
honest arrangement, and it keeps both layers on one runner and one config.

A feature file opens a session in module scope, closes it in `afterAll`, and
threads it through `context.session` — the same shape as `createHarness` in the
API journeys. Logging in is one init script: the Studio reads its token from
`localStorage` (`__studio_auth_token_<projectId>`), and standalone the App SDK
reads the same `{token}` shape from `__sanity_auth_token`, so one injection
covers both dev servers. (The SDK also takes `authConfig.token` in app config —
not used here, because that would put a token path in the app's Vite bundle.)

### Conditional tags

racejar acts on `@skip` and `@only` and ignores every other tag, so a tag that
means "only where the environment allows" is applied by `gate.ts`, which rewrites
the feature text before compiling it and prints the reason. The tag stays in the
`.feature` as the documented precondition; the scenario is skipped, never failed,
and the run says why.

| Tag                        | Closed when                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@requires-auth`           | `E2E_BROWSER_VERBS` unset (verbs write to a run — opt in explicitly), no verb offered, or a login-page bounce |
| `@requires-open-run`       | Every inbox section counts zero                                                                               |
| `@requires-sample-data`    | The dev dataset holds no such document                                                                        |
| `@requires-changed-locale` | No matrix row reports a change to the field the scenario opens                                                |

The dashboard scenarios run under the injected token. The review verbs stay
closed today: they arm only behind `E2E_BROWSER_VERBS=1`, and even armed they
need an open run in review. The inbox's row-opening scenario needs one too, and
making one is not cheap — publishing a source edit hands the deployed
`start-localization` Function a real subject and fans out to every locale with
real Agent Actions.

The two inspector journeys carry `@requires-sample-data` at feature level: they
drive a document from `studio/sample-data.ndjson` by id, and on a dataset that
never ran `pnpm bootstrap` every locator in the feature misses, so the run would
report a settle timeout that says nothing about the cause. One GROQ read
(`browser/content.ts`) turns that into a skip naming the document.

`@requires-changed-locale` covers the scenarios that need a locale with
something to read. **No locale code is pinned anywhere.** The matrix reports a
locale as changed while its pending revision differs from its published one,
which is run state: the row carrying a diff now is translated and quiet an hour
later, and a different row has taken its place. `browser/fixture.ts` opens the
inspector, reads the grid's own coverage labels and hands the scenarios whichever
row the matrix currently reports — and closes the gate when none does.

## What this does NOT cover

Being explicit, because a green suite that is quietly narrow is worse than a
missing one:

- **No browser verbs.** The Studio journeys are read-only. Approve and
  request-changes are written and tagged, not proven — see "Conditional tags"
  above for exactly why each is closed.
- **No document actions and no release picker in the browser.** The Start dialog,
  the schedule gate and the release-scoped run have no journey at either layer.
- **Every API journey rides the harness's own engine**, so no host's engine
  construction is under test here — the dashboard's is a unit spec
  (`apps/translations-dashboard/src/hooks/useL10nEngine.test.ts`), because a
  missing `resourceClients` there refuses every start while this suite stays
  green.
- **No deployed Functions.** The handlers are imported and called with a
  synthesized event envelope. The blueprint's filters, projections, robot token
  and timeouts are not exercised — a publish event that the platform would never
  route still gets delivered here.
- **Mode H drains through the harness's engine, not `functions/drain-effects`.**
  The Agent Actions seam is `createEngine({resourceClients})`, which that Function
  does not expose. Its ten lines of glue are covered by unit tests instead, and
  `heartbeat`'s stale-claim sweep is not exercised at all. `distill-review` IS
  driven as the real handler, because it takes its content client as an argument
  (`createDistillHandler`) — that is the one seam the loop needed.
- **No live model.** Translation quality is the eval suite's job
  (`pnpm --filter @starter/l10n eval`), not this one.
- **No campaign or release journeys.** `localize-campaign`, `publish-release` and
  the version write path are unproven end to end (J4/J5).
- **Guards are asserted through the engine's registry**, not by attempting a
  mutation the lake should deny.
- **Document-tier writes are unproven.** Mode H covers the field tier only; the
  sibling-document + `translation.metadata` path has no canned translate answer yet.
