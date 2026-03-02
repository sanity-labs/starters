# Studio

Sanity Studio workspace that integrates the `@starter/l10n` plugin. Defines article, person, topic, and tag document types.

## Scripts

```sh
pnpm dev                    # Start dev server
pnpm build                  # Build for deployment
pnpm typecheck              # Type-check with tsc --noEmit
pnpm seed                   # Create locale documents via migration
pnpm generate-sample-data   # AI-generate articles (requires sanity login, consumes AI credits)
pnpm import-sample-data     # Import sample data from NDJSON
pnpm bootstrap              # Deploy schema, seed locales, and import sample data
```
