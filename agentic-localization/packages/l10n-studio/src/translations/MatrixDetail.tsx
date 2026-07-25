/**
 * What the reviewer actually reads, for the cell they picked.
 *
 * Fields arrive impact-ordered — the riskiest change is line one, GitHub's
 * files-changed rule — and the heavy ones render as a badge and a character
 * count until asked for. A rewritten Portable Text body is this pane's lockfile:
 * expanding it by default would push everything else off a 296px column.
 *
 * The viewed tick is the reviewer's own bookkeeping and lives nowhere but this
 * component's state. It un-ticks itself the moment the value behind it moves,
 * which is the whole point: a second persisted status store is what killed the
 * first version of this surface.
 */

import {CheckmarkIcon, EditIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useState} from 'react'
import {useTranslation} from 'sanity'

import type {FieldChangeMagnitude} from '@starter/l10n'

import {l10nLocaleNamespace} from '../i18n'
import {FieldDiff} from './TranslationCompare'
import type {DetailField} from './useTranslationGrid'
import {fingerprint, isViewed, toggleViewed, viewedKey, type ViewedTicks} from './viewedTicks'

const MAGNITUDE_TONE: Record<
  FieldChangeMagnitude,
  'critical' | 'caution' | 'positive' | 'default'
> = {
  rewritten: 'critical',
  removed: 'critical',
  added: 'positive',
  updated: 'caution',
  minor: 'default',
  unchanged: 'default',
}

export interface MatrixDetailProps {
  locale: string
  localeTitle: string
  fields: readonly DetailField[]
  /** The cell the reviewer picked, expanded on arrival. */
  focusField: string | null
  onEditField: (editPath: string) => void
  onOpenDocument: (() => void) | null
  /** The row failed; there is nothing to compare. */
  failed: boolean
  /** No document or entry holds this locale yet. */
  missing: boolean
}

function DetailHeader({
  localeTitle,
  onOpenDocument,
}: {
  localeTitle: string
  onOpenDocument: (() => void) | null
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <Flex align="center" gap={2} paddingX={3} paddingTop={3}>
      <Text size={1} weight="semibold" textOverflow="ellipsis">
        {localeTitle}
      </Text>
      <Box flex={1} />
      {onOpenDocument && (
        <Button
          fontSize={0}
          icon={EditIcon}
          mode="ghost"
          onClick={onOpenDocument}
          padding={2}
          text={t('matrix.detail.open-doc')}
        />
      )}
    </Flex>
  )
}

function FieldCard({
  field,
  expanded,
  onToggleExpanded,
  viewed,
  onToggleViewed,
  onEditField,
}: {
  field: DetailField
  expanded: boolean
  onToggleExpanded: () => void
  viewed: boolean
  onToggleViewed: () => void
  onEditField: (editPath: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const {change} = field

  return (
    <Card border padding={3} radius={2}>
      <Stack space={3}>
        <Flex align="center" gap={2}>
          <Text size={1} textOverflow="ellipsis" weight="semibold">
            {change.fieldName}
          </Text>
          <Badge fontSize={0} mode="outline" tone={MAGNITUDE_TONE[change.magnitude]}>
            {t(`matrix.magnitude.${change.magnitude}`)}
          </Badge>
          <Box flex={1} />
          <Button
            aria-label={t('matrix.detail.viewed')}
            fontSize={0}
            icon={CheckmarkIcon}
            mode={viewed ? 'default' : 'bleed'}
            onClick={onToggleViewed}
            padding={1}
            tone={viewed ? 'positive' : 'default'}
          />
          <Button
            aria-label={t('matrix.detail.edit', {field: change.fieldName})}
            fontSize={0}
            icon={EditIcon}
            mode="bleed"
            onClick={() => onEditField(field.editPath)}
            padding={1}
          />
        </Flex>

        {expanded ? (
          <FieldDiff change={change} />
        ) : (
          <Button
            fontSize={0}
            mode="bleed"
            onClick={onToggleExpanded}
            padding={2}
            text={t('matrix.detail.show-diff', {
              count: Math.abs(field.charDelta),
              sign: field.charDelta < 0 ? '−' : '+',
            })}
          />
        )}
      </Stack>
    </Card>
  )
}

export function MatrixDetail({
  locale,
  localeTitle,
  fields,
  focusField,
  onEditField,
  onOpenDocument,
  failed,
  missing,
}: MatrixDetailProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [ticks, setTicks] = useState<ViewedTicks>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const notice = failed
    ? t('matrix.detail.failed')
    : missing
      ? t('matrix.detail.missing')
      : fields.length === 0
        ? t('matrix.detail.none')
        : null

  return (
    <Stack space={3} paddingBottom={3}>
      <DetailHeader localeTitle={localeTitle} onOpenDocument={onOpenDocument} />

      {notice ? (
        <Box paddingX={3}>
          <Card border padding={3} radius={2} tone="transparent">
            <Text muted size={1}>
              {notice}
            </Text>
          </Card>
        </Box>
      ) : (
        <Stack paddingX={3} space={3}>
          {fields.map((field) => {
            const key = viewedKey(locale, field.change.fieldName)
            const stamp = fingerprint(field.change.newValue)
            return (
              <FieldCard
                expanded={
                  expanded.has(key) || field.change.fieldName === focusField || !field.deferred
                }
                field={field}
                key={key}
                onEditField={onEditField}
                onToggleExpanded={() => setExpanded((open) => new Set(open).add(key))}
                onToggleViewed={() => setTicks((current) => toggleViewed(current, key, stamp))}
                viewed={isViewed(ticks, key, stamp)}
              />
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
