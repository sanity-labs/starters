import {defineProject} from 'vitest/config'

export default defineProject({
  test: {
    name: '@starter/translations-dashboard',
    include: ['src/**/*.test.ts'],
  },
})
