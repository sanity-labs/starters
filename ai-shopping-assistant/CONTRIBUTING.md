# Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or improvement to the docs, we appreciate your help.

## Getting started

Before contributing, please read our [Code of Conduct](CODE_OF_CONDUCT.md).

### Prerequisites

- Node.js 20.9 or newer
- [pnpm](https://pnpm.io/installation)
- A [Sanity](https://www.sanity.io/) account
- An [Anthropic](https://console.anthropic.com/) API key

### Setup

```sh
git clone https://github.com/sanity-labs/starters.git
cd starters/ai-shopping-assistant
pnpm install
```

Copy the example environment files and fill in your values:

```sh
cp app/.env.example app/.env.local
cp studio/.env.example studio/.env
```

Start both dev servers:

```sh
pnpm dev
```

The app runs on http://localhost:3000 and the Studio on http://localhost:3333.

## Making changes

1. Create a descriptive branch off `main` (e.g., `feat/product-filters` or `fix/chat-scroll`)
2. Make your changes
3. Run lint and type checks before pushing:
   ```sh
   pnpm lint
   pnpm type-check
   ```
4. Open a pull request targeting `main`

## Code style

- **App** (`app/`): Semicolons, double quotes (ESLint + Next.js defaults)
- **Studio** (`studio/`): No semicolons, single quotes, no bracket spacing (Prettier config in `studio/package.json`)
- TypeScript strict mode in both workspaces

## Pull requests

- Keep PRs focused — one concern per PR
- Include a clear description of what changed and why
- Make sure CI checks pass (lint, type-check)
- Test your changes locally before submitting

## Reporting issues

- Use [GitHub Issues](https://github.com/sanity-labs/starters/issues) for bug reports and feature requests
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) — do not file public issues

## Questions?

Join the [Sanity Community](https://www.sanity.io/community) for help and discussion.
