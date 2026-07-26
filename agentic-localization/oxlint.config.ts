import sanityPluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {type AllowWarnDeny, defineConfig} from 'oxlint'

/**
 * The node floor. `@starter/l10n` is imported by Sanity Functions, the workflow
 * CLI and the frontend; anything on this list would drag the Studio into all
 * three. `packages/l10n-studio` is where these belong.
 *
 * `allowTypeImports` stays off: a type-only import still needs the package
 * installed to typecheck, which puts it back in the dependency graph.
 * `src/exports.test.ts` proves the same property over the resolved bundle —
 * this rule is the fast feedback, that one is the ground truth.
 */
const NODE_FLOOR = {
  group: [
    'react',
    'react-dom',
    'sanity',
    'sanity/*',
    '@sanity/ui',
    '@sanity/icons',
    'styled-components',
  ],
  allowTypeImports: false,
  message:
    '@starter/l10n is the node floor: no react, no sanity, no @sanity/ui, not even type-only. Move the code to @starter/l10n-studio, or take the type from @sanity/types.',
}

const NO_BARREL_THROUGH_BARREL = {
  group: ['**/../index', '../index', '../../index'],
  message:
    'Import the module directly. Routing through the package barrel makes the graph circular and defeats tree-shaking for every consumer.',
}

/**
 * An override's entry for a rule replaces the inherited one outright — oxlint
 * does not merge rule options across levels. Every override that touches
 * `no-restricted-imports` therefore has to carry the preset's own bans forward,
 * so they are read off the preset rather than copied.
 */
function presetRestrictedImports(key: 'paths' | 'patterns'): unknown[] {
  const rule = sanityPluginKitOxlint.rules?.['eslint/no-restricted-imports']
  const options = Array.isArray(rule) ? rule[1] : undefined
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('@sanity/plugin-kit/oxlint no longer sets eslint/no-restricted-imports')
  }
  const value = Reflect.get(options, key)
  return Array.isArray(value) ? value : []
}

function restrictImports(
  ...patterns: object[]
): [AllowWarnDeny, {paths: unknown[]; patterns: unknown[]}] {
  return [
    'error',
    {
      paths: presetRestrictedImports('paths'),
      patterns: [...presetRestrictedImports('patterns'), ...patterns],
    },
  ]
}

/** Node processes and Sanity Functions, where the console is the interface. */
const CONSOLE_IS_THE_INTERFACE = [
  'e2e/**/*.ts',
  'functions/**/*.ts',
  'packages/l10n/src/prompts/evals/**/*.ts',
  'skills/evals/**/*.ts',
  'studio/migrations/**/*.ts',
  'studio/scripts/**/*.ts',
]

export default defineConfig({
  extends: [sanityPluginKitOxlint],
  // ignorePatterns do not propagate through extends, so spread the shared ones
  ignorePatterns: [
    ...(sanityPluginKitOxlint.ignorePatterns ?? []),
    'functions/**/vendor/*',
    '**/.next/*',
  ],
  options: {
    // `typeAware` stays on — the type-aware lint rules are the reason to run
    // oxlint over tsc. `typeCheck` (tsc's own diagnostics) does not: it resolves
    // projects differently from `pnpm typecheck`, reporting on files the
    // tsconfigs exclude and missing ambient declarations the same tsconfigs
    // pull in. `pnpm typecheck` is the type gate.
    typeCheck: false,
  },
  /**
   * Rules the preset denies that this starter does not satisfy yet. Every line
   * is a ratchet target: delete it once the call sites are gone, and never add
   * one without a reason.
   */
  rules: {
    // `@sanity/ui` v3 renamed `space` to `gap` and `columns` to
    // `gridTemplateColumns`. ~70 call sites across the Studio plugin and the
    // dashboard still pass the old names.
    'typescript/no-deprecated': 'off',
    // Sequencing is the point, not an oversight: workflow benches step the
    // engine one tick at a time, effects call a rate-limited model per locale,
    // and the e2e journeys are ordered by construction.
    'no-await-in-loop': 'off',
    // The house rule is no `as` at all. The assertions that remain predate it
    // and each needs a type guard, not a config line.
    'typescript/no-unsafe-type-assertion': 'off',
    'typescript/no-unnecessary-type-parameters': 'off',
    'typescript/consistent-return': 'off',
    'typescript/no-base-to-string': 'off',
    'typescript/no-floating-promises': 'off',
    'typescript/no-misused-spread': 'off',
    'typescript/require-array-sort-compare': 'off',
    'typescript/restrict-template-expressions': 'off',
    // Grid rows and diff segments are keyed by position because position is
    // their identity; the values themselves are not stable across a re-diff.
    'react/no-array-index-key': 'off',
    'react/no-object-type-as-default-prop': 'off',
    // Two dashboard components read from an API the compiler refuses to
    // memoize, and one has a genuine missing dependency.
    'react/react-compiler': 'off',
    // `@sanity/ui` renders every primitive as a `div`, so ARIA roles are the
    // only way to give a grid, listbox or button semantics.
    'jsx-a11y/prefer-tag-over-role': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'oxc/no-map-spread': 'off',
    'promise/always-return': 'off',
    'promise/no-multiple-resolved': 'off',
    'unicorn/prefer-array-find': 'off',
    'unicorn/no-new-array': 'off',
  },
  overrides: [
    {
      files: CONSOLE_IS_THE_INTERFACE,
      rules: {'eslint/no-console': 'off'},
    },
    {
      // `import 'server-only'` is how Next.js marks a module server-only. The
      // preset's allow list is replaced, not merged, so `**/*.css` is repeated.
      files: ['apps/frontend/**/*.{ts,tsx}'],
      rules: {'import/no-unassigned-import': ['error', {allow: ['**/*.css', 'server-only']}]},
    },
    {
      // The Sanity CLI and Next.js load these through their own transforms,
      // which supply `__dirname`; `import.meta.url` is not ours to assume.
      files: ['**/sanity.cli.ts', 'apps/frontend/next.config.ts'],
      rules: {'eslint/no-restricted-globals': 'off'},
    },
    {
      files: ['packages/l10n/src/**/*.{ts,tsx}'],
      rules: {
        'eslint/no-restricted-imports': restrictImports(NODE_FLOOR, NO_BARREL_THROUGH_BARREL),
      },
    },
    {
      files: ['packages/l10n-studio/src/**/*.{ts,tsx}'],
      rules: {
        'eslint/no-restricted-imports': restrictImports(NO_BARREL_THROUGH_BARREL),
      },
    },
  ],
})
