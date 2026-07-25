import config from '@starter/eslint-config'
import tseslint from 'typescript-eslint'

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
const NODE_FLOOR_BANS = [
  'react',
  'react-dom',
  'sanity',
  'sanity/*',
  '@sanity/ui',
  '@sanity/icons',
  'styled-components',
]

export default [
  {ignores: ['functions/**/vendor/', '**/dist/', '**/.sanity/', '**/sanity.types.ts', '**/.next/']},
  ...config,
  {
    name: 'l10n/node-floor',
    files: ['packages/l10n/src/**/*.ts', 'packages/l10n/src/**/*.tsx'],
    languageOptions: {parser: tseslint.parser},
    plugins: {'@typescript-eslint': tseslint.plugin},
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: NODE_FLOOR_BANS,
              allowTypeImports: false,
              message:
                '@starter/l10n is the node floor: no react, no sanity, no @sanity/ui, not even type-only. Move the code to @starter/l10n-studio, or take the type from @sanity/types.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'l10n/no-barrel-through-barrel',
    files: ['packages/l10n*/src/**/*.ts', 'packages/l10n*/src/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/../index', '../index', '../../index'],
              message:
                'Import the module directly. Routing through the package barrel makes the graph circular and defeats tree-shaking for every consumer.',
            },
          ],
        },
      ],
    },
  },
]
