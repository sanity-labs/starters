/**
 * Gap-closer view — the focused "close this gap" action screen.
 *
 * Row state is read from the open run, not from local state: a document inside
 * a `localize-document` run shows its stage and links to it, everything else
 * offers to start one.
 */

import type {ReleaseDocument} from '@sanity/sdk'
import type {SortingState} from '@tanstack/react-table'

import {getStatusDisplay} from '@starter/l10n'
import {CheckmarkCircleIcon, SparklesIcon, SpinnerIcon, TranslateIcon} from '@sanity/icons'
import {Badge, Button, Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'

import type {GapDocument, GapDocumentsData} from '../hooks/useGapDocuments'
import type {CampaignTarget} from '../hooks/useStartLocalization'

import {STATUS_ICONS} from '../lib/statusIcons'
import ReleaseSelector from './ReleaseSelector'

interface GapCloserViewProps {
  docTypeLabel: string
  gapData: GapDocumentsData
  /** A start call is in flight — the engine takes it from there. */
  isStarting?: boolean
  localeFlag: string
  localeName: string
  onStart?: (target: CampaignTarget) => void
  onStartOne?: (doc: GapDocument, target: CampaignTarget) => void
  releases?: ReleaseDocument[]
}

const SOURCE_STATUS_CONFIG: Record<
  GapDocument['sourceStatus'],
  {label: string; tone: 'caution' | 'default' | 'positive' | 'primary'}
> = {
  draft: {label: 'Draft', tone: 'caution'},
  inRelease: {label: 'In Release', tone: 'primary'},
  published: {label: 'Published', tone: 'positive'},
  unknown: {label: 'Unknown', tone: 'default'},
}

/** Numeric sort order for source status — published first */
const SOURCE_STATUS_ORDER: Record<GapDocument['sourceStatus'], number> = {
  draft: 2,
  inRelease: 1,
  published: 0,
  unknown: 3,
}

const columnHelper = createColumnHelper<GapDocument>()

function buildColumns(
  onStartOne: ((doc: GapDocument) => void) | undefined,
  onOpenRun: (instanceId: string) => void,
  isStarting: boolean,
) {
  return [
    columnHelper.accessor((row) => row.title || 'Untitled', {
      cell: (info) => (
        <Text size={1} weight="medium">
          {info.getValue()}
        </Text>
      ),
      header: 'Document',
      id: 'document',
    }),
    columnHelper.accessor((row) => SOURCE_STATUS_ORDER[row.sourceStatus], {
      cell: (info) => {
        const config = SOURCE_STATUS_CONFIG[info.row.original.sourceStatus]
        return (
          <Badge fontSize={2} padding={2} tone={config.tone}>
            {config.label}
          </Badge>
        )
      },
      header: 'Source Status',
      id: 'sourceStatus',
    }),
    columnHelper.display({
      cell: (info) => {
        const doc = info.row.original
        const display = getStatusDisplay(doc.workflowStatus)

        if (doc.instanceId) {
          return (
            <Flex justify="flex-end">
              <Button
                fontSize={2}
                icon={
                  doc.workflowStatus === 'translating' ? SpinningIcon : STATUS_ICONS[display.icon]
                }
                mode="ghost"
                onClick={() => onOpenRun(doc.instanceId ?? '')}
                padding={3}
                text={display.label}
              />
            </Flex>
          )
        }

        return (
          <Flex justify="flex-end">
            <Button
              disabled={isStarting}
              fontSize={2}
              icon={SparklesIcon}
              onClick={() => onStartOne?.(doc)}
              padding={3}
              text="Localize"
              tone="suggest"
            />
          </Flex>
        )
      },
      enableSorting: false,
      header: '',
      id: 'action',
    }),
  ]
}

/** SpinnerIcon wrapper that spins — for use as Button icon prop */
const SpinningIcon = () => <SpinnerIcon className="spinner" />

function GapCloserView({
  docTypeLabel,
  gapData,
  isStarting = false,
  localeFlag,
  localeName,
  onStart,
  onStartOne,
  releases = [],
}: GapCloserViewProps) {
  const navigate = useNavigate()
  const {documents, sourceBreakdown, totalMissing, workflowBreakdown} = gapData
  const [target, setTarget] = useState<CampaignTarget>({kind: 'drafts'})

  const startable = documents.filter((doc) => doc.instanceId === null)

  const columns = useMemo(
    () =>
      buildColumns(
        onStartOne ? (doc) => onStartOne(doc, target) : undefined,
        (instanceId) => navigate(`/runs/${instanceId}`),
        isStarting,
      ),
    [onStartOne, target, navigate, isStarting],
  )

  const [sorting, setSorting] = useState<SortingState>([{desc: false, id: 'sourceStatus'}])

  const table = useReactTable({
    columns,
    data: documents,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {sorting},
  })

  const progressSegments = useMemo(() => {
    if (totalMissing === 0) return []
    const segments: Array<{color: string; percentage: number}> = []

    if (sourceBreakdown.published > 0) {
      segments.push({
        color: 'var(--card-positive-fg-color, #3ab667)',
        percentage: (sourceBreakdown.published / totalMissing) * 100,
      })
    }
    if (sourceBreakdown.inRelease > 0) {
      segments.push({
        color: 'var(--card-primary-fg-color, #6e56cf)',
        percentage: (sourceBreakdown.inRelease / totalMissing) * 100,
      })
    }
    if (sourceBreakdown.draft > 0) {
      segments.push({
        color: 'var(--card-caution-fg-color, #d4a024)',
        percentage: (sourceBreakdown.draft / totalMissing) * 100,
      })
    }

    return segments
  }, [sourceBreakdown, totalMissing])

  if (totalMissing === 0) {
    return (
      <Card padding={5} radius={2} tone="positive">
        <Stack className="text-center" space={3}>
          <Text size={3}>
            <CheckmarkCircleIcon />
          </Text>
          <Text size={2} weight="semibold">
            All caught up!
          </Text>
          <Text muted size={1}>
            All {docTypeLabel.toLowerCase()} are translated in {localeName}.
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Stack space={4}>
      <Stack className="text-center" space={3}>
        <Heading as="h2" size={3}>
          {localeFlag} <strong>{docTypeLabel}</strong> missing in <strong>{localeName}</strong>
        </Heading>
        <Text align="center" muted size={1}>
          {totalMissing} {docTypeLabel.toLowerCase()} need translation
          {workflowBreakdown.translating > 0 && ` · ${workflowBreakdown.translating} in progress`}
        </Text>
      </Stack>

      <Card border padding={4} radius={2}>
        <Stack space={4}>
          <Stack space={3}>
            <Text className="uppercase tracking-widest" muted size={0} weight="semibold">
              Source document status
            </Text>
            <Flex gap={2} wrap="wrap">
              {sourceBreakdown.published > 0 && (
                <Badge fontSize={2} padding={2} tone="positive">
                  {sourceBreakdown.published} Published
                </Badge>
              )}
              {sourceBreakdown.inRelease > 0 && (
                <Badge fontSize={2} padding={2} tone="primary">
                  {sourceBreakdown.inRelease} In Release
                </Badge>
              )}
              {sourceBreakdown.draft > 0 && (
                <Badge fontSize={2} padding={2} tone="caution">
                  {sourceBreakdown.draft} Draft
                </Badge>
              )}
            </Flex>
          </Stack>

          <div className="flex h-6 overflow-hidden rounded bg-card-border">
            {progressSegments.map((seg, i) => (
              <div
                key={i}
                style={{
                  background: seg.color,
                  width: `${seg.percentage}%`,
                }}
              />
            ))}
          </div>

          <Flex align="flex-end" gap={3} wrap="wrap">
            <Button
              disabled={isStarting || startable.length === 0}
              fontSize={1}
              icon={isStarting ? SpinningIcon : TranslateIcon}
              onClick={() => onStart?.(target)}
              padding={3}
              text={`Localize ${startable.length} document${startable.length === 1 ? '' : 's'}`}
              tone="suggest"
            />
            <ReleaseSelector
              disabled={isStarting}
              onChange={setTarget}
              releases={releases}
              value={target}
            />
          </Flex>
        </Stack>
      </Card>

      <Stack space={2}>
        <Text muted size={0}>
          Sorted by source status: published first
        </Text>

        <Card border className="overflow-hidden" radius={2}>
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const ariaSort =
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'

                    return (
                      <th
                        aria-sort={canSort ? ariaSort : undefined}
                        className={`border-b border-black/[0.06] px-3 py-2 text-left select-none ${canSort ? 'cursor-pointer' : ''}`}
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(e) => {
                          if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                            header.column.getToggleSortingHandler()?.(e)
                          }
                        }}
                        style={{
                          width:
                            header.id === 'sourceStatus'
                              ? 140
                              : header.id === 'action'
                                ? 220
                                : undefined,
                        }}
                        tabIndex={canSort ? 0 : undefined}
                      >
                        <Text muted={!sorted} size={1} weight={sorted ? 'semibold' : 'medium'}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? ' ↑' : ''}
                          {sorted === 'desc' ? ' ↓' : ''}
                        </Text>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  className={`border-b border-black/[0.06] ${i % 2 === 0 ? 'bg-black/[0.02]' : ''}`}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td className="px-3 py-2 align-middle" key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Stack>
    </Stack>
  )
}

export default GapCloserView
