import config from '@starter/eslint-config'

export default [
  {
    ignores: ['**/dist/', '**/.sanity/', '**/sanity.types.ts', '**/.next/', '**/.astro/'],
  },
  ...config,
  {
    files: ['scripts/**/*.mjs', '**/astro.config.mjs'],
    languageOptions: {globals: {process: 'readonly', console: 'readonly'}},
  },
]
