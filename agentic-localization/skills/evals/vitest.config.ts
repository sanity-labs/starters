import {defineProject} from 'vitest/config'

export default defineProject({
  test: {
    name: '@starter/skill-evals',
    include: ['*.test.ts'],
  },
})
