/** @type {import('lint-staged').Configuration} */
export default {
  /** Lint and format source files */
  '*.{js,mjs,ts,tsx}': [
    'eslint --fix --cache --cache-location node_modules/.cache/eslint/',
    'oxfmt',
  ],
  /** Format non-source assets */
  '*.{json,css,md,html,yaml,yml}': 'oxfmt',
}
