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
    input: {index: 'analyze-stale-translations/index.ts'},
    ...shared,
    output: {...shared.output, dir: 'dist/analyze-stale-translations', cleanDir: true},
  },
  {
    input: {index: 'mark-translations-stale/index.ts'},
    ...shared,
    output: {...shared.output, dir: 'dist/mark-translations-stale', cleanDir: true},
  },
])
