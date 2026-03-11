import {defineConfig} from 'rolldown'

export default [
  defineConfig({
    input: {index: 'import-klaviyo/index.ts'},
    output: {
      dir: 'dist/import-klaviyo',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
  defineConfig({
    input: {index: 'send-email/index.ts'},
    output: {
      dir: 'dist/send-email',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
]
