/**
 * The chrome strings are declared twice: as fields here, and as paths in
 * `FIELD_TIER['l10n.uiStrings']` inside `@starter/l10n`. They cannot be one
 * declaration — the registry is read inside a Function, which has no compiled
 * Studio schema to walk, and `@starter/l10n` is the dependency of this package
 * rather than the other way round.
 *
 * Studio is the only package that sees both, so this is where they are held
 * together. A field added to the schema and not registered never fans out to
 * translation; one registered and not declared patches a field nothing renders.
 *
 * The document's contract is one `internationalizedArray` per string, so every
 * field is expected in the registry — adding a plain field here is a deliberate
 * change to that contract and this test is where it surfaces.
 */

import type {InternationalizedField} from '@starter/l10n'

import {internationalizedFields} from '@starter/l10n'
import {expect, it} from 'vitest'

import {uiStrings} from './uiStrings'

const ITEM_TYPES: Record<string, InternationalizedField['itemType']> = {
  internationalizedArrayString: 'internationalizedArrayStringValue',
  internationalizedArrayText: 'internationalizedArrayTextValue',
}

const byPath = (fields: {path: string; itemType: string}[]) =>
  [...fields].sort((a, b) => a.path.localeCompare(b.path))

it('registers every chrome string in the field tier, with the item type it stores', () => {
  const declared = uiStrings.fields.map((field) => ({
    path: field.name,
    itemType: ITEM_TYPES[field.type],
  }))
  const registered = internationalizedFields(uiStrings.name).map(({path, itemType}) => ({
    path,
    itemType,
  }))

  expect(byPath(registered)).toEqual(byPath(declared))
})
