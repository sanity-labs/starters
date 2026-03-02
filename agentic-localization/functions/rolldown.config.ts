import {defineConfig, type RolldownOptions} from 'rolldown'

const shared = {
  output: {
    codeSplitting: false,
    minify: true,
    comments: false,
  },
  platform: 'node',
} satisfies Partial<RolldownOptions>

export default defineConfig([
  {
    input: {'analyze-stale-translations': 'analyze-stale-translations.ts'},
    ...shared,
    output: {...shared.output, cleanDir: true},
  },
  {
    input: {'mark-translations-stale': 'mark-translations-stale.ts'},
    ...shared,
  },
])
