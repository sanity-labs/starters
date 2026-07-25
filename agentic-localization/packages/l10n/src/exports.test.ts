/**
 * The node floor, enforced.
 *
 * Every entry of this package has to be importable from a Sanity Function, the
 * CLI or a frontend without dragging the Studio in. That is a property of the
 * *resolved module graph*, not of any one file's import list, so it is checked
 * the only way that cannot be fooled: bundle each entry with rolldown and read
 * back the module ids it resolved.
 *
 * Deliberately not a `grep` over bundle output — minification renames
 * identifiers, and a string match proves nothing either way. `moduleIds` is the
 * ground truth.
 */

import {rolldown} from 'rolldown'
import {expect, test} from 'vitest'

/** Resolved ids may not name any of these packages. */
const FORBIDDEN =
  /node_modules\/(react|react-dom|sanity|@sanity\/ui|@sanity\/icons|styled-components)\//

/** Every entry in `package.json#exports`, by the barrel it points at. */
const ENTRIES = {
  '.': 'src/index.ts',
  './prompts': 'src/prompts/index.ts',
  './workflows': 'src/workflows/index.ts',
  './effects': 'src/effects/index.ts',
  './credentials': 'src/credentials/index.ts',
} as const

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname

async function moduleIdsFor(entry: string): Promise<string[]> {
  const build = await rolldown({
    input: `${PACKAGE_ROOT}${entry}`,
    platform: 'node',
    // Peers and deps resolve at the consumer, not here. Leaving them external
    // keeps the graph to this package's own modules plus whatever it truly
    // pulls in, which is exactly what the assertion is about.
    logLevel: 'silent',
  })
  try {
    const {output} = await build.generate({format: 'esm'})
    return output.flatMap((chunk) => (chunk.type === 'chunk' ? chunk.moduleIds : []))
  } finally {
    await build.close()
  }
}

test.each(Object.entries(ENTRIES))(
  '`@starter/l10n%s` resolves no Studio or React module',
  async (_specifier, entry) => {
    const ids = await moduleIdsFor(entry)

    // Anti-vacuity: an entry that failed to resolve anything would pass the
    // assertion below trivially. Every barrel here reaches real dependencies.
    expect(ids.filter((id) => id.includes('node_modules')).length).toBeGreaterThan(0)

    expect(ids.filter((id) => FORBIDDEN.test(id))).toEqual([])
  },
  30_000,
)
