import {defineConfig} from 'rolldown'

const fn = (name: string) =>
  defineConfig({
    input: {index: `${name}/index.ts`},
    output: {
      dir: `dist/${name}`,
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  })

export default [fn('analytics-sync'), fn('agent-triage'), fn('agent-review-resolve')]
