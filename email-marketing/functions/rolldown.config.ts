import {defineConfig} from 'rolldown'

export default [
  defineConfig({
    input: {index: 'import-resend-segments/index.ts'},
    output: {
      dir: 'dist/import-resend-segments',
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
    input: {index: 'scheduled-import-resend-segments/index.ts'},
    output: {
      dir: 'dist/scheduled-import-resend-segments',
      cleanDir: true,
      codeSplitting: false,
      minify: true,
      comments: false,
    },
    platform: 'node',
  }),
]
