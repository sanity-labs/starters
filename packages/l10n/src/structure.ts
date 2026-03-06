import {map} from 'rxjs/operators'
import {DEFAULT_STUDIO_CLIENT_OPTIONS} from 'sanity'
import type {DocumentListBuilder} from 'sanity/structure'
import {globalLocaleFilter$} from './localeFilterState'
import {languageFieldName} from './types'

/**
 * Reactive observable that composes the global locale selection from the navbar
 * onto an existing DocumentListBuilder, preserving its current filter and params.
 * Pass the result to any list item's `.child()`.
 *
 * @example
 * S.documentTypeListItem('article').child(() =>
 *   withLocaleFilter(S.documentTypeList('article'))
 * )
 */
export function withLocaleFilter(list: DocumentListBuilder) {
  return globalLocaleFilter$.pipe(
    map((selectedLocales: string[]) => {
      if (selectedLocales.length === 0) return list

      const existingFilter = list.getFilter()
      const existingParams = list.getParams() ?? {}

      return list
        .filter(`${existingFilter} && ${languageFieldName} in $languages`)
        .params({...existingParams, languages: selectedLocales})
        .apiVersion(DEFAULT_STUDIO_CLIENT_OPTIONS.apiVersion)
    }),
  )
}
