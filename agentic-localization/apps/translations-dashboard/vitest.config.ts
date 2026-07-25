import {defineProject} from 'vitest/config'

export default defineProject({
  // `sanity.cli.ts` defines these at dev and build time; a module that reads
  // them has to import cleanly under vitest too.
  define: {
    'import.meta.env.SANITY_APP_DATASET': JSON.stringify('production'),
    'import.meta.env.SANITY_APP_PROJECT_ID': JSON.stringify('test-project'),
    'import.meta.env.SANITY_APP_STUDIO_URL': JSON.stringify(''),
  },
  test: {
    name: '@starter/translations-dashboard',
    include: ['src/**/*.test.ts'],
  },
})
