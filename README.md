# Sanity Starters

Production-ready starter templates for building with Sanity.

Each starter is a standalone project you can spin up with the Sanity CLI:

```sh
pnpm create sanity@latest --template sanity-labs/starters/<starter-name>
```

> Using npm? Run `npm create sanity@latest -- --template sanity-labs/starters/<starter-name>` (note the extra `--`).

## Starters

| Starter | Description |
| --- | --- |
| [agentic-localization](./agentic-localization) | AI translation with glossaries, style guides, quality evals, and a translations dashboard |
| [ai-shopping-assistant](./ai-shopping-assistant) | Ecommerce storefront with a Claude chatbot powered by Context MCP |

## Repo structure

This is a flat collection of independent projects — not a monorepo with shared dependencies. Each starter has its own `package.json`, workspace config, and CI workflows that work when cloned standalone.

The root provides shared DX for maintainers:

- **Husky** — formats and lint-fixes staged files on commit
- **CI** — runs checks across all starters on push/PR
- **`.gitignore`** — minimal root-level ignores; each starter manages its own

## Development

```sh
pnpm install        # install root DX tools (husky, oxfmt, eslint)
cd <starter-name>
pnpm install        # install the starter's dependencies
pnpm dev            # run the starter locally
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add a new starter.
