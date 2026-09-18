import {defineConfig} from 'rolldown'

export default defineConfig({
  input: {index: 'set-review-date/index.ts'},
  output: {
    dir: 'dist/set-review-date',
    cleanDir: true,
    codeSplitting: false,
    minify: true,
    comments: false,
  },
  platform: 'node',
})
