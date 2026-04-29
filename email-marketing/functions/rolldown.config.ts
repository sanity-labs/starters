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
    input: {index: 'on-promotion-approved/index.ts'},
    output: {
      dir: 'dist/on-promotion-approved',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
  defineConfig({
    input: {index: 'scheduled-import-klaviyo/index.ts'},
    output: {
      dir: 'dist/scheduled-import-klaviyo',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
]
