import type {FilterDefault} from 'next-sanity'

/**
 * `l10n.locale.code` is routing data, not prose: it keys the fallback graph and
 * builds every locale URL. The client's default filter leaves `language` and
 * `slug.current` alone but has no rule for `code`, and an encoded code breaks
 * both uses. `fallback` is that same field reached through the reference, so
 * one rule on the source path covers it.
 */
export const stegaFilter: FilterDefault = (props) =>
  props.sourcePath.at(-1) === 'code' ? false : props.filterDefault(props)
