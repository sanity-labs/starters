---
name: sanity-l10n
description: 'The agentic localization pattern: translation context (glossaries, style guides, locale rules) stored as Sanity content, assembled into Agent Actions Translate prompts, orchestrated as durable Editorial Workflows runs with a human review gate, and distilled back into context from what reviewers correct. Use this skill when adding that pipeline to a project — greenfield or an existing Studio and dataset — when extending it with a custom workflow definition or effect handler, when authoring glossaries and style guides, or when operating a run: deploying the blueprint Functions and workflow definitions, reading a stuck instance, or debugging a translation. Also use it for where the locale list itself belongs — locales as l10n.locale documents rather than a hardcoded array — and for a translation run holding a document: publish or schedule greyed out, a run parked in review, a locale that failed while the others succeeded. Triggers on agentic localization, translation glossary, do-not-translate terms, translation style guide, prompt assembly, Agent Actions translate, localize-document, localize-locale, effect handler, drain-effects, workflow bench, translation review gate, translation eval, stale translation detection, distillation loop. DO NOT use for general Sanity internationalization modelling — document-level vs field-level, @sanity/document-internationalization or internationalizedArray setup, language field patterns — that is sanity-best-practices. DO NOT use for rendering localized content in a frontend — locale routing, locale switcher, fallback content — that is add-l10n-frontend.'
---

# Agentic Localization

Machine translation becomes enterprise-grade through context, not through a
better engine. A human translator gets a glossary, a style guide and a brief; an
AI translator usually gets none of that. This pattern stores that context as
content, assembles it into every translation prompt, puts a human at the review
gate, and feeds what the human corrects back into the context.

This repository is the reference implementation. Use it three ways: read it to
learn the pattern, copy its elements into a project, or build your own workflow
on its layers.

## The pattern

| Phase         | What happens                                                                                 | Lives in                                       |
| ------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Context**   | Locales, glossaries and style guides are documents editors maintain                          | `packages/l10n-studio/src/schemas/`            |
| **Assembly**  | Query the context, prune the glossary to terms the source actually contains, build a prompt  | `packages/l10n/src/prompts/promptAssembly.ts`  |
| **Run**       | A publish starts one durable workflow instance that analyses, fans out, retries and gates    | `packages/l10n/src/workflows/`                 |
| **Translate** | An effect handler calls Agent Actions Translate with the assembled prompt and writes it      | `packages/l10n/src/effects/translateLocale.ts` |
| **Review**    | A person compares source against translation and approves or requests changes                | `packages/l10n-studio/src/translations/`       |
| **Publish**   | Approval publishes drafts, or a campaign ships a Content Release on a schedule               | `packages/l10n/src/effects/publishRelease.ts`  |
| **Distill**   | The diff between machine draft and approved text becomes proposed glossary and guide entries | `packages/l10n/src/distill/`                   |

The loop closes: distillation writes **draft** proposals, a human accepts them
into a glossary or style guide, and the next run's assembly reads them. Nothing
automation writes reaches a prompt without two human acts.

Load `references/pattern.md` for how each phase actually works, both
localization tiers, and what the engine owns versus what your code owns.

## Non-negotiables

A project that satisfies less than this cannot run the pattern:

1. **Locales are content, not a constant.** Everything — assembly, fan-out, the
   frontend, the dashboard — reads `l10n.locale` documents. A hardcoded array
   breaks the moment an editor adds a market.
2. **The schema is deployed.** Agent Actions resolves the target against the
   deployed schema (`sanity schema deploy`), not the local one.
3. **The engine has storage and a runtime.** Editorial Workflows keeps instances
   in a dedicated dataset and has no daemon: Sanity Functions dispatch its
   effects. Both are blueprint resources.
4. **Run state lives on the instance.** Content documents carry content. No
   status field, no per-locale ledger, no "is this stale yet" cache.
5. **A named human owns the gate.** Automation proposes — translations, glossary
   entries, style-guide rules — and never publishes context on its own. Name that
   person during adoption, along with where their queue lives: without one, runs
   park in review and nothing ships. It is the most common way an adoption
   stalls, and no amount of correct code fixes it.

## Where to go next

| Task                                                                             | Load                      |
| -------------------------------------------------------------------------------- | ------------------------- |
| Understand the pipeline, the two tiers, or which layer owns a behaviour          | `references/pattern.md`   |
| Add localization to a project — new project, or an existing Studio and dataset   | `references/adopting.md`  |
| Build a translation workflow the shipped definitions do not cover                | `references/extending.md` |
| Run, observe or debug a live pipeline — deploys, stuck runs, failed translations | `references/operating.md` |

The packages document their own surface. Read
[`packages/l10n/README.md`](../../packages/l10n/README.md) for the node floor's
entries and [`packages/l10n-studio/README.md`](../../packages/l10n-studio/README.md)
for the Studio layer's, rather than asking for an export list.
[`docs/decisions/`](../../docs/decisions/) records why the packages are shaped
this way (adr-001) and why the loop is an observer rather than a phase
(adr-002); [`docs/functions.md`](../../docs/functions.md) is the runtime map.

## Anti-patterns

- **Do not hand-roll orchestration.** Fan-out, retries, concurrency limits, job
  status, review gates and idempotency are engine primitives. A semaphore, a
  status enum, or a `for` loop over locales means the engine is being reinvented.
- **Do not edit a workflow instance as content.** Every write goes through an
  engine verb (`fireAction`, `editField`, `tick`, `completeEffect`) or it
  bypasses guards, history and the transaction boundary.
- **Do not deploy a definition you have not run on the bench.**
  `@sanity/workflow-engine-test` runs the real engine in memory, no project and
  no network. It catches spawn-identity, cohort-gating and recovery bugs that
  otherwise only appear against a live dataset.
- **Do not mix `@sanity/workflow-*` versions.** They are exact-version peers and
  ship breaking changes in minor releases. Pin exactly, upgrade as one set.
- **Do not let React, `sanity` or `@sanity/ui` into `@starter/l10n`.** Functions
  inline everything they import. The node floor is what makes one definition
  runnable in a Function, the CLI, an eval and a frontend.
- **Do not inject a whole glossary into a prompt.** Filter to the terms the
  source document contains; keep do-not-translate and forbidden terms always.
- **Do not skip the review gate to "save a step."** The gate is where the
  training signal for the distillation loop comes from.

## Companion skills

- **sanity-best-practices** — general Sanity i18n modelling: document-level vs
  field-level, plugin setup, language fields.
- **add-l10n-frontend** — rendering localized content: locale routing, locale
  switcher, fallback content.
