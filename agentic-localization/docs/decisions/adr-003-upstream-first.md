# ADR-003: Upstream first; a first-party module needs a stated exception

Date: 2026-07-25 · Status: accepted

## Decision

Every capability this starter needs is taken from a Sanity-managed package
(`sanity-io`, `sanity-labs`, or the Portable Text ecosystem) unless the file
that hand-rolls it says why. The exception lives as a header comment on the
symbol — upstream candidate named, reason it loses — not in a doc that drifts
from the code. Adding a dependency is cheaper than owning a variant; deleting
ours when upstream catches up is the expected end of every exception.

Every refactor and review runs the dedup pass: does any first-party module
replicate, or hand-roll what could come from, a Sanity-managed package —
installed or not.

## Adopted

| Capability                                          | Upstream                                | Representative site                                    |
| --------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Fan-out, retries, guards, idempotency ledger        | `@sanity/workflow-engine`               | `packages/l10n/src/workflows/localizeDocument.ts`      |
| Definitions proven in memory, deterministic clock   | `@sanity/workflow-engine-test`          | `packages/l10n/src/workflows/localizeDocument.test.ts` |
| Stage surface and action locks in the Studio        | `@sanity/workflow-studio-plugin`        | `studio/sanity.config.ts`                              |
| Draft / version / published id algebra              | `@sanity/id-utils`                      | `packages/l10n/src/core/ids.ts`                        |
| Structural and character diff                       | `@sanity/diff`                          | `packages/l10n/src/core/textDiff.ts`                   |
| Value paths, deep-empty, type resolution, safe JSON | `@sanity/util`                          | `packages/l10n/src/core/fieldTier.ts`                  |
| Crop / hotspot defaults and comparison              | `@sanity/asset-utils`                   | `packages/l10n/src/translate/imageUtils.ts`            |
| Portable Text ↔ markdown for prompts                | `@portabletext/markdown`                | `packages/l10n/src/prompts/promptAssembly.ts`          |
| Plain text out of Portable Text                     | `@portabletext/toolkit`                 | `packages/l10n/src/prompts/promptAssembly.ts`          |
| Typed GROQ                                          | `groq`, `@sanity/codegen`               | `packages/l10n/src/prompts/queries.ts`                 |
| Content ops and Agent Actions                       | `@sanity/client`                        | `packages/l10n/src/effects/translateLocale.ts`         |
| Document-tier translation metadata                  | `@sanity/document-internationalization` | `packages/l10n-studio/src/plugin.ts`                   |
| Field-tier localized arrays                         | `sanity-plugin-internationalized-array` | `packages/l10n-studio/src/plugin.ts`                   |
| Function runtime and document events                | `@sanity/functions`                     | `functions/start-localization/index.ts`                |

`sanity`, `@sanity/ui`, `@sanity/icons` and `@sanity/sdk-react` are the
substrate the Studio and the dashboard are built out of, not rows in this table.

## Exceptions

Each one is a header comment at the site; this index only says where.

| Site                                                                                     | Instead of                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/l10n/src/core/extractBlockText.ts`                                             | `@portabletext/toolkit`'s `toPlainText`                             |
| `packages/l10n/src/core/textDiff.ts` (`alignToWords`)                                    | nothing to adopt: `@sanity/diff-match-patch` 3.2.0 has no word mode |
| `packages/l10n/src/core/typeNames.ts` (`languageFieldName`)                              | the plugins' unexported `LANGUAGE_FIELD_NAME`                       |
| `packages/l10n/src/core/types.ts` (`InternationalizedArrayItem`, `TranslationReference`) | the plugins' declarations, re-stated and contract-tested            |
| `packages/l10n/src/translate/imageUtils.ts` (`isSanityImageField`)                       | `@sanity/types`' `isImage`                                          |
| `packages/l10n-studio/src/localeFilterState.ts`                                          | `@sanity/language-filter`'s selection; `sanity`'s key-value store   |
| `apps/frontend/src/negotiateLocale.ts` (`LOCALE_PATTERN`)                                | `@starter/l10n`'s `isValidLocale`                                   |
| `apps/translations-dashboard/src/components/ErrorBoundary.tsx`                           | `@sanity/ui`'s `ErrorBoundary`                                      |
| `apps/translations-dashboard/src/components/OpenInStudioButton.tsx`                      | `@sanity/sdk-react`'s `useNavigateToStudioDocument`                 |

## Outcomes of the audit that produced this

- **A release-scoped slug validated against nothing.** The slug uniqueness check
  stripped `drafts.` with a regex, so in a release `$id` stayed a version id and
  `!(sanity::versionOf($id))` excluded only that one document — the document's
  own published counterpart failed it for its own slug. `getPublishedId` from
  `@sanity/id-utils` is the whole fix. The validator moved to
  `packages/l10n-studio/src/schemas/`, beside the rest of the
  document-internationalization integration, with a spec.
- **One fence stripper.** Three byte-identical copies of the same
  ` ```json ` unwrap became `packages/l10n/src/core/stripJsonFence.ts`; nothing
  upstream offers it.
