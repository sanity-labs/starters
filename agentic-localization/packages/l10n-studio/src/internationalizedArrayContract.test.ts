/**
 * `@starter/l10n` declares the `internationalizedArray` item shapes itself
 * rather than importing them, because the plugins that own them are Studio-only
 * and the node floor has to read and write those shapes inside a Function.
 *
 * This is where the two declarations are held together. Studio is the only
 * package that depends on both, so this is the only place the check can live.
 * The assertions are type-level and prove structural equivalence in both
 * directions — a field added, removed or re-typed upstream fails `typecheck`.
 */

import type {TranslationReference as OwnTranslationReference} from '@starter/l10n'
import type {InternationalizedArrayItem as OwnItem} from '@starter/l10n'
import type {TranslationReference as PluginTranslationReference} from '@sanity/document-internationalization'
import type {InternationalizedArrayItem as PluginItem} from 'sanity-plugin-internationalized-array'

import {expect, it} from 'vitest'

/** Resolves to `true` only when `A` and `B` are mutually assignable. */
type Extends<A, B> = A extends B ? true : false

// --- InternationalizedArrayItem ---

const itemMatchesPlugin: Extends<OwnItem<string>, PluginItem<string>> = true
const pluginMatchesItem: Extends<PluginItem<string>, OwnItem<string>> = true

// --- TranslationReference ---

const refMatchesPlugin: Extends<OwnTranslationReference, PluginTranslationReference> = true
const pluginMatchesRef: Extends<PluginTranslationReference, OwnTranslationReference> = true

it('keeps the node floor types structurally identical to the plugins that own them', () => {
  expect([itemMatchesPlugin, pluginMatchesItem, refMatchesPlugin, pluginMatchesRef]).toEqual([
    true,
    true,
    true,
    true,
  ])
})
