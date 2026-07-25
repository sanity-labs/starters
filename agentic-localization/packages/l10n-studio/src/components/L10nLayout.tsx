/**
 * The Studio layout the plugin mounts: the locale and glossary providers, plus
 * the one instance subscription the localization inbox runs on.
 *
 * One subscription, not one per surface. The structure's section counts, the
 * rows inside each section and anything else that asks "what is running right
 * now" read `localizationRuns$`; only this component talks to the engine, for
 * the same reason `L10nProvider` owns the locale listener — a listener per
 * consumer is a reconnection storm.
 *
 * It renders beside the provider rather than around it, inside a boundary that
 * renders nothing: a workflows dataset that cannot be read costs the editor
 * their inbox, never their Studio.
 */

import {useEffect, useMemo} from 'react'
import {ErrorBoundary} from 'react-error-boundary'
import type {LayoutProps} from 'sanity'

import {useWorkflowInstances} from '@sanity/workflow-studio'

import {L10nProvider} from '../L10nProvider'
import {bucketRuns, publishLocalizationRuns, subjectRunFromInstance} from '../runSections'
import {LOCALIZE_DOCUMENT_DEFINITION, useLocalizationEngine} from '../translations/workflowEngine'

/**
 * Module scope so the instance list never resubscribes on a repaint — the
 * filter's identity is what the observer keys its live read on.
 */
const OPEN_LOCALIZATIONS = {
  definition: LOCALIZE_DOCUMENT_DEFINITION,
  includeCompleted: false,
} as const

function LocalizationRunsSubscriber() {
  const engine = useLocalizationEngine()
  const {instances} = useWorkflowInstances({engine, filter: OPEN_LOCALIZATIONS})

  const sections = useMemo(
    () =>
      bucketRuns((instances ?? []).flatMap((instance) => subjectRunFromInstance(instance) ?? [])),
    [instances],
  )

  useEffect(() => publishLocalizationRuns(sections), [sections])

  return null
}

export function L10nLayout(props: LayoutProps) {
  return (
    <>
      <ErrorBoundary fallback={null}>
        <LocalizationRunsSubscriber />
      </ErrorBoundary>
      <L10nProvider {...props} />
    </>
  )
}
