/**
 * Hold `schedule` while a localization run is open.
 *
 * The engine already holds `publish`: `localize-document` declares a guard over
 * its subject in both `translating` and `review`, and
 * `@sanity/workflow-studio-plugin` disables the matching document action from
 * it. Its `LOCKABLE_ACTIONS` map covers `publish`, `unpublish` and `delete` —
 * not `schedule`, which is how a source would otherwise slip out mid-run.
 *
 * So this closes exactly one hole, and it closes it the same way: read the run,
 * disable with a reason, never mutate. No content state is consulted; a document
 * with no open run schedules as it always did.
 */

import {createElement} from 'react'
import {
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
} from 'sanity'
import {Text} from '@sanity/ui'

import {useLocalizationInstance} from './workflowEngine'

/** Stages a run passes through before there is anything to schedule. */
const STAGE_REASON: Record<string, string> = {
  analyzing: 'Localization is working out which locales this change affects.',
  translating: 'Localization is translating this document.',
  review: 'Localization is waiting on review. Approve the run, then schedule.',
}

export function createLocalizationScheduleGate(
  WrappedAction: DocumentActionComponent,
): DocumentActionComponent {
  function LocalizationScheduleGate(props: DocumentActionProps): DocumentActionDescription | null {
    const originalResult = WrappedAction(props)
    const {instance} = useLocalizationInstance(props.id)

    if (!originalResult || !instance) return originalResult

    return {
      ...originalResult,
      disabled: true,
      title: createElement(
        Text,
        {size: 1},
        STAGE_REASON[instance.currentStage] ?? 'A localization run is open for this document.',
      ),
      tone: 'caution',
    }
  }

  LocalizationScheduleGate.action = WrappedAction.action
  LocalizationScheduleGate.displayName = 'LocalizationScheduleGate'
  return LocalizationScheduleGate
}
