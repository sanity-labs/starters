/**
 * Every open `localize-document` run, keyed by the document it is about.
 *
 * Reactive by construction — `useWorkflowInstances` observes the engine's
 * dataset through the App SDK store, so there is nothing to poll and no status
 * to cache. `loading: false` with an empty map is a confirmed "no runs".
 */

import type {Engine} from '@sanity/workflow-engine'
import type {SubjectRun} from '@starter/l10n'

import {useWorkflowInstances} from '@sanity/workflow-sdk'
import {readSubjectRun} from '@starter/l10n'
import {localizeDocument} from '@starter/l10n/workflows'
import {useMemo} from 'react'

export interface LocalizationRuns {
  bySubject: Map<string, SubjectRun>
  loading: boolean
}

export function useLocalizationRuns(engine: Engine): LocalizationRuns {
  const {instances, loading} = useWorkflowInstances({
    engine,
    filter: {definition: localizeDocument.name, includeCompleted: false},
  })

  return useMemo(() => {
    const bySubject = new Map<string, SubjectRun>()
    for (const instance of instances ?? []) {
      const run = readSubjectRun(instance)
      if (run) bySubject.set(run.subjectId, run)
    }
    return {bySubject, loading}
  }, [instances, loading])
}
