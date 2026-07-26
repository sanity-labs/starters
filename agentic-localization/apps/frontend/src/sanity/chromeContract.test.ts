/**
 * The chrome strings are declared twice inside this app — as the keys of
 * `UI_STRING_DEFAULTS` and as the projection `CHROME_QUERY` asks for — and a
 * third time as fields on `l10n.uiStrings` in the Studio schema. A key missing
 * from the projection silently renders its default forever; a key missing from
 * the defaults is fetched and dropped.
 *
 * The app takes no workspace dependency on the l10n packages, so the schema is
 * reached the only way it already is: through TypeGen. `sanity.types.ts` is
 * generated from `studio/schema.json`, and `CHROME_QUERY_RESULT` is that schema
 * read through the query text — so pinning the two against each other pins the
 * projection to the schema with nothing imported across the boundary.
 *
 * Both assertions are type-level; `tsc --noEmit` is the gate, and root
 * `typecheck` regenerates the types first.
 */

import type {CHROME_QUERY_RESULT, L10nUiStrings} from './sanity.types'
import type {UiStringKey} from './uiStrings'

import {expectTypeOf, it} from 'vitest'

/** The `strings` projection, as TypeGen resolved `CHROME_QUERY` against the schema. */
type QueriedStrings = NonNullable<CHROME_QUERY_RESULT['strings']>

/**
 * The same projection as the schema would produce it: every field of the
 * document, nullable because GROQ cannot promise one is set. The document's
 * contract is one string per field, so system fields are the only exclusion.
 */
type SchemaStrings = {
  [K in Exclude<keyof L10nUiStrings, `_${string}`>]: NonNullable<L10nUiStrings[K]> | null
}

it('queries exactly the chrome strings the schema declares, and defaults every one', () => {
  expectTypeOf<QueriedStrings>().toEqualTypeOf<SchemaStrings>()
  expectTypeOf<keyof QueriedStrings>().toEqualTypeOf<UiStringKey>()
})
