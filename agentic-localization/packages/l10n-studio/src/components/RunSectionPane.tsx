/**
 * One section of the localization inbox, as a pane of its own.
 *
 * A structure `documentList` cannot carry run state: the list pane renders its
 * rows through `SanityDefaultPreview` directly, bypassing both
 * `schemaType.components.preview` and the plugin-level `form.components.preview`
 * middleware, so there is no seam to hang a stage chip on — and giving every row
 * its own listener to find one is the reconnection storm the whole plugin is
 * built to avoid. So the section owns its rows: the run comes from
 * `localizationRuns$`, which is already subscribed once, and the document behind
 * it comes from a single query over the section's ids.
 *
 * The row's jump is a sibling pane, resolved by the child resolver this pane is
 * given in `structure.ts` — so the document opens with its views, its Workflows
 * tab and the Translations inspector all intact.
 */

import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {defineQuery} from 'groq'
import {useMemo} from 'react'
import {useObservable} from 'react-rx'
import type {Observable} from 'rxjs'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  Preview,
  PreviewCard,
  useDocumentStore,
  useSchema,
  useTranslation,
} from 'sanity'
import type {UserComponent} from 'sanity/structure'
import type {SUBJECT_DOCUMENTS_QUERY_RESULT} from '@starter/sanity-types'

import {getFlagFromCode} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'
import {useOpenSiblingPane} from '../translations/paneNavigation'
import {
  EMPTY_RUN_SECTIONS,
  localizationRuns$,
  RUN_SECTIONS,
  type RunSectionId,
  type SubjectRun,
} from '../runSections'

const SUBJECT_DOCUMENTS_QUERY = defineQuery(`*[_id in $ids]{_id, _type}`)

function isRunSection(value: unknown): value is RunSectionId {
  return RUN_SECTIONS.some((section) => section === value)
}

/** The document each subject id resolves to, or nothing once the query settles. */
function useSubjectTypes(runs: readonly SubjectRun[]): {
  typeById: ReadonlyMap<string, string>
  loading: boolean
} {
  const documentStore = useDocumentStore()
  const ids = runs.map((run) => run.subjectId).join(',')

  const documents$: Observable<SUBJECT_DOCUMENTS_QUERY_RESULT> = useMemo(
    () =>
      documentStore.listenQuery(
        SUBJECT_DOCUMENTS_QUERY,
        {ids: ids ? ids.split(',') : []},
        DEFAULT_STUDIO_CLIENT_OPTIONS,
      ),
    [documentStore, ids],
  )

  const documents = useObservable(documents$)

  return useMemo(
    () => ({
      typeById: new Map((documents ?? []).map((document) => [document._id, document._type])),
      loading: documents === undefined,
    }),
    [documents],
  )
}

function LocaleChips({locales}: {locales: readonly string[]}) {
  const {t} = useTranslation(l10nLocaleNamespace)

  if (locales.length === 0) {
    return (
      <Text muted size={0}>
        {t('inbox.locales.undecided')}
      </Text>
    )
  }

  return (
    <Text muted size={0}>
      {locales.map((locale) => `${getFlagFromCode(locale)} ${locale}`.trim()).join(' · ')}
    </Text>
  )
}

function RunRow({
  run,
  documentType,
  loading,
}: {
  run: SubjectRun
  documentType: string | undefined
  loading: boolean
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const schema = useSchema()
  const openSibling = useOpenSiblingPane()
  const schemaType = documentType ? schema.get(documentType) : undefined

  const body = (
    <Stack space={3}>
      {schemaType ? (
        <Preview layout="default" schemaType={schemaType} value={{_id: run.subjectId}} />
      ) : (
        <Text muted size={1} textOverflow="ellipsis">
          {loading ? run.subjectId : t('inbox.subject-missing', {documentId: run.subjectId})}
        </Text>
      )}
      <Flex align="center" gap={2} wrap="wrap">
        <Badge fontSize={0} mode="outline" tone="primary">
          {t(`matrix.stage.${run.stage}`, {defaultValue: run.stage})}
        </Badge>
        {run.sourceChanged && (
          <Badge fontSize={0} tone="caution">
            {t('inbox.badge.source-changed')}
          </Badge>
        )}
        {run.hasFailedLocales && (
          <Badge fontSize={0} tone="critical">
            {t('status.failed.label')}
          </Badge>
        )}
        <LocaleChips locales={run.locales} />
      </Flex>
    </Stack>
  )

  if (!schemaType || !documentType) {
    return (
      <Card padding={2} radius={2} tone="transparent">
        {body}
      </Card>
    )
  }

  return (
    <PreviewCard
      as="button"
      onClick={() => openSibling({documentId: run.subjectId, documentType})}
      padding={2}
      radius={2}
    >
      {body}
    </PreviewCard>
  )
}

export const RunSectionPane: UserComponent = ({options}) => {
  const {t} = useTranslation(l10nLocaleNamespace)
  const sections = useObservable(localizationRuns$, EMPTY_RUN_SECTIONS)
  const section = options?.section
  const runs = isRunSection(section) ? sections[section] : []
  const {typeById, loading} = useSubjectTypes(runs)

  if (runs.length === 0) {
    return (
      <Box padding={3}>
        <Card border padding={3} radius={2} tone="transparent">
          <Text align="center" muted size={1}>
            {t('inbox.empty')}
          </Text>
        </Card>
      </Box>
    )
  }

  return (
    <Stack padding={2} space={1}>
      {runs.map((run) => (
        <RunRow
          documentType={typeById.get(run.subjectId)}
          key={run.instanceId}
          loading={loading}
          run={run}
        />
      ))}
    </Stack>
  )
}
