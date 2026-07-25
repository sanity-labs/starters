/**
 * The compare-scope selector, made two-dimensional.
 *
 * Studio's own review pane (`ChangesInspector`) is a fixed scope header over a
 * scrolling diff list; this is the same shape with a locale axis added. Every
 * target locale gets a row whether or not the run touched it — a locale that
 * never came back is the failure that ships, and a grid whose height moves with
 * the run is a silhouette nobody learns.
 *
 * Cells are glyphs and nothing else. The old field matrix died of per-cell
 * verbs, not of pixels: the only action here is the `↻` on a locale whose run
 * failed, and all it does is open the footer's own request-changes dialog with
 * that locale pre-checked.
 */

import {SyncIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Text, Tooltip} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {useTranslation} from 'sanity'

import {l10nLocaleNamespace} from '../i18n'
import type {Locale} from '../L10nProvider'
import {CELL_GLYPH, type CellState, type GridModel, type GridRow} from './gridModel'

/** Widths that keep a five-column grid legible in the inspector's 296px. */
const LOCALE_COLUMN = 74
const AFFORDANCE_COLUMN = 24

const CELL_COLOR: Partial<Record<CellState, string>> = {
  updated: 'var(--card-badge-caution-fg-color)',
  rewritten: 'var(--card-badge-critical-fg-color)',
  missing: 'var(--card-badge-critical-fg-color)',
  failed: 'var(--card-badge-critical-fg-color)',
}

/** Beyond this the grid needs horizontal scroll, so the reviewer picks instead. */
export const GRID_COLUMN_LIMIT = 6

const LEGEND: readonly CellState[] = ['same', 'minor', 'updated', 'rewritten', 'missing']

export type GridPresentation = 'grid' | 'rows'

export interface LocaleFieldGridProps {
  model: GridModel
  locales: readonly Locale[]
  presentation: GridPresentation
  selectedLocale: string | null
  selectedField: string | null
  onSelect: (locale: string, field: string | null) => void
  /** Open the run's document (document tier) or focus its field (field tier). */
  onOpen: (locale: string) => void
  /** False when the locale has nothing to open — no sibling, no entry. */
  canOpen: (locale: string) => boolean
  /** Ask for this locale again — the footer dialog, pre-checked. */
  onRetry: (locale: string) => void
}

/**
 * True once the element it is attached to has scrolled out of the scroller —
 * the cue for the pinned bar to absorb the identity of what left. An observer
 * rather than a scroll listener, because the scroller belongs to the frame and
 * ancestor clipping is exactly what `IntersectionObserver` already accounts for.
 */
export function useAbsorbed(): [(node: HTMLDivElement | null) => void, boolean] {
  const [absorbed, setAbsorbed] = useState(false)
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return undefined
    const observer = new IntersectionObserver(([entry]) => setAbsorbed(!entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, absorbed]
}

export function CellGlyph({state}: {state: CellState}) {
  return (
    <Text
      align="center"
      muted={state === 'same'}
      size={1}
      style={CELL_COLOR[state] ? {color: CELL_COLOR[state]} : undefined}
    >
      {CELL_GLYPH[state]}
    </Text>
  )
}

export function CellLegend() {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <Flex gap={2} paddingX={3} paddingY={2} wrap="wrap">
      {LEGEND.map((state) => (
        <Flex align="center" gap={1} key={state}>
          <CellGlyph state={state} />
          <Text muted size={0}>
            {t(`matrix.state.${state}`)}
          </Text>
        </Flex>
      ))}
    </Flex>
  )
}

function LocaleLabel({flag, locale}: {flag: string | undefined; locale: string}) {
  return (
    <Flex align="center" gap={1} style={{minWidth: 0}}>
      {flag && <Text size={1}>{flag}</Text>}
      <Text size={0} textOverflow="ellipsis" weight="medium">
        {locale}
      </Text>
    </Flex>
  )
}

function RowAffordance({
  row,
  onOpen,
  canOpen,
  onRetry,
}: {
  row: GridRow
  onOpen: (locale: string) => void
  canOpen: (locale: string) => boolean
  onRetry: (locale: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const failed = row.state === 'failed'
  const label = failed
    ? t('matrix.row.retry', {locale: row.locale})
    : t('matrix.row.open', {locale: row.locale})

  if (!failed && !canOpen(row.locale)) return <Box />

  return (
    <Tooltip
      animate
      content={
        <Box padding={2}>
          <Text size={1}>{label}</Text>
        </Box>
      }
      placement="left"
      portal
    >
      <Button
        aria-label={label}
        fontSize={0}
        icon={failed ? SyncIcon : undefined}
        mode="bleed"
        onClick={() => (failed ? onRetry(row.locale) : onOpen(row.locale))}
        padding={1}
        text={failed ? undefined : '›'}
        tone={failed ? 'critical' : undefined}
      />
    </Tooltip>
  )
}

function ColumnGrid({
  model,
  locales,
  selectedLocale,
  selectedField,
  onSelect,
  onOpen,
  canOpen,
  onRetry,
}: LocaleFieldGridProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  // `repeat(0, …)` is invalid and collapses the whole track list, so a run that
  // moved nothing still needs a column to take up the slack.
  const fields =
    model.columns.length > 0 ? `repeat(${model.columns.length}, minmax(0, 1fr))` : '1fr'
  const template = `${LOCALE_COLUMN}px ${fields} ${AFFORDANCE_COLUMN}px`

  return (
    <Box role="grid">
      <Box
        paddingX={2}
        paddingY={1}
        role="row"
        style={{display: 'grid', gridTemplateColumns: template, gap: 4}}
      >
        <Text muted size={0} weight="medium">
          {t('matrix.column.locale')}
        </Text>
        {model.columns.map((field) => (
          <Tooltip
            animate
            content={
              <Box padding={2}>
                <Text size={1}>{field}</Text>
              </Box>
            }
            key={field}
            placement="bottom"
            portal
          >
            <Text align="center" muted role="columnheader" size={0} textOverflow="ellipsis">
              {field}
            </Text>
          </Tooltip>
        ))}
        <Box />
      </Box>

      {model.rows.map((row) => (
        <Card
          key={row.locale}
          paddingX={2}
          paddingY={0}
          pressed={row.locale === selectedLocale}
          radius={1}
          role="row"
          style={{display: 'grid', gridTemplateColumns: template, alignItems: 'center', gap: 4}}
          tone={row.state === 'failed' ? 'critical' : undefined}
        >
          <Button
            aria-label={t('matrix.row.select', {locale: row.locale})}
            mode="bleed"
            onClick={() => onSelect(row.locale, null)}
            padding={1}
            style={{justifyContent: 'flex-start', minWidth: 0}}
          >
            <LocaleLabel
              flag={locales.find((candidate) => candidate.id === row.locale)?.flag}
              locale={row.locale}
            />
          </Button>
          {row.cells.map((cell) => (
            <Button
              aria-label={t('matrix.cell.label', {
                locale: row.locale,
                field: cell.field,
                state: t(`matrix.state.${cell.state}`),
              })}
              key={cell.field}
              mode="bleed"
              onClick={() => onSelect(row.locale, cell.field)}
              padding={1}
              selected={row.locale === selectedLocale && cell.field === selectedField}
            >
              <CellGlyph state={cell.state} />
            </Button>
          ))}
          {row.cells.length === 0 && <Box />}
          <RowAffordance canOpen={canOpen} onOpen={onOpen} onRetry={onRetry} row={row} />
        </Card>
      ))}
    </Box>
  )
}

/** The drill-in fallback: one row per locale, the field axis condensed. */
function LocaleList({
  model,
  locales,
  selectedLocale,
  onSelect,
  onOpen,
  canOpen,
  onRetry,
}: LocaleFieldGridProps) {
  const {t} = useTranslation(l10nLocaleNamespace)

  return (
    <Box>
      {model.rows.map((row) => (
        <Card
          key={row.locale}
          paddingX={2}
          pressed={row.locale === selectedLocale}
          radius={1}
          tone={row.state === 'failed' ? 'critical' : undefined}
        >
          <Flex align="center" gap={1}>
            <Button
              aria-label={t('matrix.row.select', {locale: row.locale})}
              mode="bleed"
              onClick={() => onSelect(row.locale, null)}
              padding={1}
              style={{flex: 1, justifyContent: 'flex-start', minWidth: 0}}
            >
              <Flex align="center" gap={2} style={{minWidth: 0}}>
                <LocaleLabel
                  flag={locales.find((candidate) => candidate.id === row.locale)?.flag}
                  locale={row.locale}
                />
                <Flex>
                  {row.cells.map((cell) => (
                    <CellGlyph key={cell.field} state={cell.state} />
                  ))}
                </Flex>
                <Text muted size={0} textOverflow="ellipsis">
                  {row.state === 'failed'
                    ? t('matrix.row.failed')
                    : row.state === 'missing'
                      ? t('matrix.row.missing')
                      : t('matrix.row.changed', {count: row.changed})}
                </Text>
              </Flex>
            </Button>
            <RowAffordance canOpen={canOpen} onOpen={onOpen} onRetry={onRetry} row={row} />
          </Flex>
        </Card>
      ))}
    </Box>
  )
}

export function LocaleFieldGrid(props: LocaleFieldGridProps) {
  return props.presentation === 'grid' ? <ColumnGrid {...props} /> : <LocaleList {...props} />
}
