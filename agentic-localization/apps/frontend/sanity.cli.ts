import {defineCliConfig} from 'sanity/cli'

/**
 * Typegen only — there is no Studio here.
 *
 * The app sits outside `studio/sanity.cli.ts`'s typegen glob so it stays a plain
 * Next app you can lift out, but it still wants generated types for its own
 * `defineQuery` calls. It reads the schema the Studio extracts rather than
 * extracting one itself: `sanity schema extract` needs a Studio config, and the
 * schema is the Studio's to define. Run `pnpm typecheck` from the root, which
 * regenerates `studio/schema.json` before any workspace typechecks.
 */
export default defineCliConfig({
  typegen: {
    schema: '../../studio/schema.json',
    path: './src/**/*.{ts,tsx}',
    generates: './src/sanity/sanity.types.ts',
  },
})
