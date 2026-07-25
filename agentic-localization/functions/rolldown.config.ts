import {defineConfig, type RolldownOptions} from 'rolldown'

const shared = {
  output: {
    codeSplitting: false,
    minify: true,
    comments: false,
  },
  platform: 'node',
} satisfies Partial<RolldownOptions>

// One config object per function, not one config with several entries:
// `codeSplitting: false` only guarantees no chunks *within* an entry.
const functions = [
  'drain-effects',
  'start-localization',
  'handle-deleted-subject',
  'heartbeat',
  'distill-review',
]

export default defineConfig(
  functions.map((name) => ({
    input: {index: `${name}/index.ts`},
    ...shared,
    output: {...shared.output, dir: `dist/${name}`, cleanDir: true},
  })),
)
