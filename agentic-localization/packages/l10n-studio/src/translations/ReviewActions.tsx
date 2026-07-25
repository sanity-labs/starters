/**
 * The reviewer's verbs on an open `localize-document` run.
 *
 * Every button is one engine action fired through the session — there is no
 * local status to keep in step. The definition owns which verbs exist, their
 * copy, and whether they are allowed right now; this only renders the verdict.
 * `reviewActionView` maps it: absent, automation, or a button.
 *
 * The request-changes dialog is controlled from outside because it has a second
 * entry point: the grid's `↻` on a failed locale opens this same dialog with
 * that one locale pre-checked, rather than growing a per-cell verb of its own.
 */

import {CheckmarkCircleIcon, EditIcon, SyncIcon} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Grid,
  Stack,
  Text,
  TextArea,
  Tooltip,
} from '@sanity/ui'
import type {ActionEvaluation, ActivityEvaluation} from '@sanity/workflow-engine'
import {useState, useTransition} from 'react'
import {useTranslation} from 'sanity'

import {l10nLocaleNamespace} from '../i18n'
import {disabledMessage, fireableActions} from './reviewActionView'

const REVIEW_ACTIVITY = 'review'
const APPROVE = 'approve'
const REQUEST_CHANGES = 'request-changes'
const REFRESH_FROM_SOURCE = 'refresh-from-source'

const ACTION_ICON: Record<string, typeof CheckmarkCircleIcon | undefined> = {
  [APPROVE]: CheckmarkCircleIcon,
  [REQUEST_CHANGES]: EditIcon,
  [REFRESH_FROM_SOURCE]: SyncIcon,
}

const ACTION_TONE: Record<string, 'positive' | 'caution' | 'default' | undefined> = {
  [APPROVE]: 'positive',
  [REQUEST_CHANGES]: 'caution',
  [REFRESH_FROM_SOURCE]: 'default',
}

export interface ReviewActionsProps {
  activity: ActivityEvaluation
  /** Locales the reviewer can ask to redo. */
  locales: readonly string[]
  /** Locales pre-checked in the dialog; `null` keeps it closed. */
  requestChangesFor: readonly string[] | null
  onRequestChangesFor: (locales: readonly string[] | null) => void
  onFire: (args: {action: string; params?: Record<string, unknown>}) => Promise<unknown>
}

function ActionButton({
  evaluation,
  onClick,
  pending,
}: {
  evaluation: ActionEvaluation
  onClick: () => void
  pending: boolean
}) {
  const name = evaluation.action.name
  const message = disabledMessage(evaluation.disabledReason)
  const button = (
    <Button
      disabled={!evaluation.allowed || pending}
      fontSize={1}
      icon={ACTION_ICON[name]}
      mode={name === APPROVE ? 'default' : 'ghost'}
      onClick={onClick}
      padding={3}
      text={evaluation.action.title ?? name}
      tone={ACTION_TONE[name] ?? 'default'}
      style={{width: '100%'}}
    />
  )

  if (!message) return button
  return (
    <Tooltip
      animate
      content={
        <Box padding={2}>
          <Text size={1}>{message}</Text>
        </Box>
      }
      placement="top"
      portal
    >
      <Box>{button}</Box>
    </Tooltip>
  )
}

function RequestChangesDialog({
  locales,
  preselected,
  onClose,
  onSubmit,
  pending,
}: {
  locales: readonly string[]
  preselected: readonly string[]
  onClose: () => void
  onSubmit: (args: {note: string; locales: string[]}) => void
  pending: boolean
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  // Pre-checked to whatever opened the dialog: every locale from the footer
  // verb, exactly one from a failed row's retry.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(preselected))
  const [note, setNote] = useState('')

  const toggle = (locale: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(locale)) next.delete(locale)
      else next.add(locale)
      return next
    })
  }

  const canSubmit = note.trim().length > 0 && selected.size > 0 && !pending

  return (
    <Dialog
      header={t('review.request-changes.title')}
      id="l10n-request-changes"
      onClose={onClose}
      width={1}
      footer={
        <Flex gap={2} justify="flex-end" padding={3}>
          <Button
            fontSize={1}
            mode="bleed"
            onClick={onClose}
            padding={3}
            text={t('review.request-changes.cancel')}
          />
          <Button
            disabled={!canSubmit}
            fontSize={1}
            onClick={() => onSubmit({note: note.trim(), locales: [...selected]})}
            padding={3}
            text={t('review.request-changes.submit', {count: selected.size})}
            tone="caution"
          />
        </Flex>
      }
    >
      <Stack padding={4} space={4}>
        <Stack space={3}>
          <Text size={1} weight="medium">
            {t('review.request-changes.note-label')}
          </Text>
          <TextArea
            fontSize={1}
            onChange={(event) => setNote(event.currentTarget.value)}
            padding={3}
            placeholder={t('review.request-changes.note-placeholder')}
            rows={3}
            value={note}
          />
        </Stack>
        <Stack space={3}>
          <Text size={1} weight="medium">
            {t('review.request-changes.locales-label')}
          </Text>
          {locales.map((locale) => (
            <Flex align="center" gap={3} key={locale}>
              <Checkbox
                checked={selected.has(locale)}
                id={`l10n-redo-${locale}`}
                onChange={() => toggle(locale)}
              />
              <Text as="label" htmlFor={`l10n-redo-${locale}`} size={1}>
                {locale}
              </Text>
            </Flex>
          ))}
        </Stack>
      </Stack>
    </Dialog>
  )
}

export function ReviewActions({
  activity,
  locales,
  requestChangesFor,
  onRequestChangesFor,
  onFire,
}: ReviewActionsProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [pending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)

  const actions = fireableActions(activity.actions)
  if (actions.length === 0) return null

  // A rejected commit inside a transition would otherwise be silent — the
  // reviewer has to know their decision did not land.
  const fire = (action: string, params?: Record<string, unknown>) => {
    setFailure(null)
    startTransition(async () => {
      try {
        await onFire({action, params})
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error))
      }
    })
  }

  const requestChanges = ({note, locales: picked}: {note: string; locales: string[]}) => {
    onRequestChangesFor(null)
    // `locales` is a required json param — rows are shaped like targetLocales
    // so the fan-out projection reads either array the same way.
    fire(REQUEST_CHANGES, {note, locales: picked.map((locale) => ({locale, reason: note}))})
  }

  return (
    <Stack space={3}>
      <Grid columns={actions.length > 2 ? 2 : 1} gap={2}>
        {actions.map((action) => (
          <ActionButton
            evaluation={action}
            key={action.action.name}
            onClick={() =>
              action.action.name === REQUEST_CHANGES
                ? onRequestChangesFor(locales)
                : fire(action.action.name)
            }
            pending={pending}
          />
        ))}
      </Grid>
      {actions.some((action) => action.action.name === REFRESH_FROM_SOURCE) && (
        <Text muted size={0}>
          {t('review.refresh-cost')}
        </Text>
      )}
      {failure && (
        <Card border padding={2} radius={2} tone="critical">
          <Text size={0}>{failure}</Text>
        </Card>
      )}
      {requestChangesFor && (
        <RequestChangesDialog
          locales={locales}
          onClose={() => onRequestChangesFor(null)}
          onSubmit={requestChanges}
          pending={pending}
          preselected={requestChangesFor}
        />
      )}
    </Stack>
  )
}

export {REVIEW_ACTIVITY}
