import {defineProject} from 'vitest/config'

export default defineProject({
  test: {
    name: '@starter/l10n',
    include: ['**/*.test.ts'],
    env: {LANG: 'en_US.UTF-8'},
  },
})
