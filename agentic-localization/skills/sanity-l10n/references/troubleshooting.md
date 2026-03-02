# Troubleshooting

## Agent Actions Errors

### "Schema not found" or empty translations

Agent Actions requires a deployed schema. Deploy it:

```sh
cd studio && pnpm exec sanity schema deploy
```

The schema ID is `_.schemas.default` (derived from the workspace name in
`sanity.config.ts`). If you renamed the workspace, the schema ID changes.

### Auth token not resolved

`getCliClient` from `sanity/cli` does NOT resolve auth tokens outside the CLI
process. Its `__internal__getToken` defaults to `() => undefined`.

For evals and scripts, use the helper at `packages/l10n/evals/authToken.ts`:

1. Checks `SANITY_AUTH_TOKEN` env var
2. Falls back to `ConfigStore('sanity')` (reads from `~/.config/sanity/`)

For functions, the robot token is provisioned by the blueprint and injected
automatically — no manual token handling needed.

### Style guide too large

`measureStyleGuide()` warns when the assembled style guide exceeds 12,000
characters (~3,000 tokens). The Agent Actions API has a soft limit on style
guide size.

To reduce size:

- Use `filterGlossaryByContent()` to prune irrelevant terms
- Keep `additionalInstructions` concise
- Split large glossaries by domain — only pass the relevant one

## Schema Errors

### "SchemaError: Unknown type"

`localizedSchemaTypes` in `studio/sanity.config.ts` must only list types that
actually exist in `studio/schemaTypes/`. Referencing a nonexistent type causes a
SchemaError during `sanity schema deploy` and `sanity dev`.

### Type name conflicts

Don't define l10n schema types manually — the plugin registers `l10n.locale`,
`l10n.glossary`, `l10n.style-guide`, etc. via `createL10n()`. Defining them
again in `studio/schemaTypes/` causes duplicate type errors.

## Eval Failures

### Low scores despite correct translation

The judge compares `sourceText` against the translated field content. If
`sourceText` in the eval case doesn't match what was actually written to the
document's field, scores will be artificially low. Make sure the eval fixture's
`sourceText` matches the field being translated.

### Anthropic API schema errors

Zod schemas with `.int().min().max()` produce `minimum`/`maximum` on `integer`
type, which the Anthropic API rejects. Use `.number()` with range described in
`.describe()` instead.

### Judge variance

The LLM judge is averaged over 3 trials (`JUDGE_TRIALS = 3`) to reduce
variance. If scores fluctuate, check that `expectations.description` gives the
judge clear, objective criteria — vague descriptions produce inconsistent scores.

## Intl API Quirks

### `Intl.DisplayNames` output

`Intl.DisplayNames('en').of('en-US')` returns "American English", not
"English (US)". The locale resolution in `resolveLocaleDefaults()` accounts for
this.

### Plural categories vary by locale

`Intl.PluralRules('fr-FR')` returns 3 categories (one, other, many), not 2.
The `pluralize()` utility in the plugin handles this correctly.

### BCP-47 validation

`isValidLocale()` uses the `Intl.Locale` constructor. Invalid codes throw — the
schema validation in `translationLocale.tsx` catches this.

## Functions Issues

### Dependencies not found at runtime

Sanity Functions use Vite to bundle. The transpiler resolves from the nearest
`node_modules/` walking up from the function directory. Runtime deps
(`@sanity/client`, `@sanity/functions`, `groq`) and workspace packages
(`@starter/l10n`) must be in the root `package.json` devDeps.

Workspace packages resolve via pnpm symlinks and get INLINED by Vite (the
resolved path doesn't match the `/node_modules/` external pattern). This is
expected — don't add a function-level `package.json`.

### Env vars not loading in blueprint

The blueprint file is loaded by jiti, not Node.js directly.
`process.loadEnvFile()` silently succeeds but doesn't actually set env vars in
the jiti context. The blueprint uses `readFileSync` + manual line-by-line
parsing. See the top of `sanity.blueprint.ts`.

`import.meta.dirname` IS synthesized correctly by jiti. `process.cwd()`
reflects the pnpm filter's cwd, NOT the blueprint file's directory.

### Functions CLI location

The CLI finds the blueprint by walking UP from cwd. Run function commands from
the repo root:

```sh
pnpm exec sanity functions test <name> --project-id X --dataset Y
```

`sanity.config.ts` is NOT required for functions/blueprints — `resolveRootDir`
falls back to cwd.
