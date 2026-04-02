import {defineConfig} from 'rolldown'

export default [
  defineConfig({
    input: {index: 'sync-list/index.ts'},
    output: {
      dir: 'dist/sync-list',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
  defineConfig({
    input: {index: 'sync-audience/index.ts'},
    output: {
      dir: 'dist/sync-audience',
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
