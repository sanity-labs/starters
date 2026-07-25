import {ErrorOutlineIcon, SyncIcon, TaskIcon, WarningOutlineIcon} from '@sanity/icons'
import type {ComponentType} from 'react'
import {from, type Observable} from 'rxjs'
import {map, switchMap} from 'rxjs/operators'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, type LocaleSource} from 'sanity'
import type {
  DocumentListBuilder,
  ListBuilder,
  ListItemBuilder,
  StructureBuilder,
} from 'sanity/structure'
import {globalLocaleFilter$} from './localeFilterState'
import {languageFieldName} from '@starter/l10n'
import {RunSectionPane} from './components/RunSectionPane'
import {l10nLocaleNamespace} from './i18n'
import {localizationRuns$, RUN_SECTIONS, type RunSectionId} from './runSections'

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

const SECTION_ICONS: Record<RunSectionId, ComponentType> = {
  'needs-review': TaskIcon,
  translating: SyncIcon,
  'source-changed': WarningOutlineIcon,
  'failed-locales': ErrorOutlineIcon,
}

/**
 * The localization group, with the run-state inbox on top of it.
 *
 * Every section is a pane of its own rather than a `documentList`, because run
 * state lives in the workflows dataset and a content list cannot join it — see
 * `RunSectionPane`, which owns the rows and the reason.
 *
 * The counts are live because a pane node may be an Observable: the structure
 * resolves panes with `switchMap`, so each emission replaces the list in place,
 * and the pane's React key is its node id, so nothing below it remounts. They
 * are interpolated through `i18n.t` rather than a list item's `.i18n()` because
 * `I18nTextRecord` carries a key and a namespace but no values — which also
 * means a locale switch reaches these titles only when the inbox next changes.
 */
export function withRunSections(
  S: StructureBuilder,
  i18n: LocaleSource,
  items: readonly ListItemBuilder[],
): Observable<ListBuilder> {
  const t = (key: string, values?: Record<string, unknown>) =>
    i18n.t(key, {ns: l10nLocaleNamespace, ...values})

  return from(i18n.loadNamespaces([l10nLocaleNamespace])).pipe(
    switchMap(() => localizationRuns$),
    map((sections) =>
      S.list()
        .id('localization')
        .title(t('inbox.title'))
        .items([
          ...RUN_SECTIONS.map((section) => {
            const title = t(`inbox.section.${section}`)
            return S.listItem()
              .id(section)
              .title(t('inbox.section-count', {title, total: sections[section].length}))
              .icon(SECTION_ICONS[section])
              .child(
                S.component(RunSectionPane)
                  .id(section)
                  .title(title)
                  .options({section})
                  // The row's jump lands here: a subject id plus the type the
                  // row already knew, resolved through the workspace's own
                  // document node so the run's views and inspectors come with it.
                  .child((documentId, {params, structureContext}) =>
                    params.type
                      ? structureContext.resolveDocumentNode({
                          documentId,
                          schemaType: params.type,
                        })
                      : undefined,
                  ),
              )
          }),
          S.divider(),
          ...items,
        ]),
    ),
  )
}
