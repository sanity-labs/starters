/**
 * Gap-closer view — the focused "close this gap" action screen.
 *
 * Shows when user drills down from the heatmap with type+locale params:
 * - Scoped header: "🇲🇽 Articles missing in Mexican Spanish"
 * - Source status breakdown with progress bar
 * - Hero batch CTA with release picker
 * - TanStack Table document list sorted by source status (published first)
 *
 */

import type {ReleaseDocument} from '@sanity/sdk'
import type {SortingState} from '@tanstack/react-table'

import {CheckmarkCircleIcon, SparklesIcon, SpinnerIcon, TranslateIcon} from '@sanity/icons'
import {Badge, Button, Card, Flex, Heading, Label, Stack, Text} from '@sanity/ui'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {useMemo, useState} from 'react'

import type {GapDocument, GapDocumentsData} from '../hooks/useGapDocuments'

import ReleaseSelector from './ReleaseSelector'

// --- Types ---

interface GapCloserViewProps {
  /** Document type label (e.g., "Articles") */
  docTypeLabel: string
  /** Gap documents data from useGapDocuments */
  gapData: GapDocumentsData
  /** Whether a batch translation is in progress */
  isTranslating?: boolean
  /** Locale flag emoji */
  localeFlag: string
  /** Locale display name (e.g., "Mexican Spanish") */
  localeName: string
  /** Callback to translate multiple documents (published or all) */
  onTranslateBatch?: (docIds: string[], docTypes: string[], targetReleaseId?: string) => void
  /** Callback to translate a single document */
  onTranslateSingle?: (docId: string, docType: string, targetReleaseId?: string) => void
  /** Active releases for the release picker */
  releases?: ReleaseDocument[]
  /** Set of document IDs that have been translated */
  translatedIds?: Set<string>
  /** Set of document IDs currently being translated */
  translatingIds?: Set<string>
}

// --- Source status display ---

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

// --- TanStack Column Definitions ---

const columnHelper = createColumnHelper<GapDocument>()

function buildColumns(
  translatingIds: Set<string>,
  translatedIds: Set<string>,
  onTranslateSingle:
    | ((docId: string, docType: string, targetReleaseId?: string) => void)
    | undefined,
  selectedReleaseId: string,
  releases: ReleaseDocument[],
) {
  return [
    columnHelper.accessor((row) => row.title || 'Untitled', {
      cell: (info) => (
        <Text
          size={1}
          style={{
            textDecoration: translatedIds.has(info.row.original.documentId)
              ? 'line-through'
              : 'none',
          }}
          weight="medium"
        >
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
        const isTranslated = translatedIds.has(doc.documentId)
        const isTranslating = translatingIds.has(doc.documentId)

        if (isTranslated) {
          return (
            <Flex justify="flex-end">
              <Button
                disabled
                fontSize={2}
                icon={CheckmarkCircleIcon}
                padding={3}
                text="Translated"
                tone="positive"
              />
            </Flex>
          )
        }
        if (isTranslating) {
          return (
            <Flex justify="flex-end">
              <Button
                disabled
                fontSize={2}
                icon={SpinningIcon}
                padding={3}
                text="Translating..."
                tone="suggest"
              />
            </Flex>
          )
        }

        const {label, releaseId} = resolveRowTarget(doc, selectedReleaseId, releases)

        return (
          <Flex justify="flex-end">
            <Button
              fontSize={2}
              icon={SparklesIcon}
              onClick={() => onTranslateSingle?.(doc.documentId, doc.documentType, releaseId)}
              padding={3}
              text={`Translate → ${label}`}
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

/**
 * Extract the release ID from a versioned document ID (versions.{releaseId}.{docId}).
 */
function extractReleaseId(documentId: string): string | undefined {
  if (!documentId.startsWith('versions.')) return undefined
  return documentId.split('.')[1]
}

/**
 * Resolve the effective target release and its display label for a given document row.
 * inRelease sources are forced into their source release, overriding user selection.
 */
function resolveRowTarget(
  doc: GapDocument,
  selectedReleaseId: string,
  releases: ReleaseDocument[],
): {label: string; releaseId: string | undefined} {
  if (doc.sourceStatus === 'inRelease') {
    const sourceReleaseId = extractReleaseId(doc.documentId)
    if (sourceReleaseId) {
      const release = releases.find((r) => r.name === sourceReleaseId)
      return {
        label: release?.metadata?.title || release?.name || sourceReleaseId,
        releaseId: sourceReleaseId,
      }
    }
  }

  if (selectedReleaseId) {
    const release = releases.find((r) => r.name === selectedReleaseId)
    return {
      label: release?.metadata?.title || release?.name || selectedReleaseId,
      releaseId: selectedReleaseId,
    }
  }

  return {label: 'Drafts', releaseId: undefined}
}

// --- Animation Styles ---

/** SpinnerIcon wrapper that spins — for use as Button icon prop */
const SpinningIcon = () => <SpinnerIcon className="spinner" />

// --- Component ---

function GapCloserView({
  docTypeLabel,
  gapData,
  isTranslating = false,
  localeFlag,
  localeName,
  onTranslateBatch,
  onTranslateSingle,
  releases = [],
  translatedIds = new Set(),
  translatingIds = new Set(),
}: GapCloserViewProps) {
  const {documents, sourceBreakdown, totalMissing} = gapData

  const remainingCount = documents.length - translatedIds.size
  const allDone = remainingCount === 0 && documents.length > 0

  // Release picker state
  const [selectedReleaseId, setSelectedReleaseId] = useState('')

  // Release name for CTA label suffix
  const selectedRelease = releases.find((r) => r.name === selectedReleaseId)
  const targetSuffix =
    selectedRelease && selectedReleaseId
      ? ` → ${selectedRelease.metadata.title || selectedRelease.name}`
      : ''

  // TanStack Table setup
  const columns = useMemo(
    () =>
      buildColumns(translatingIds, translatedIds, onTranslateSingle, selectedReleaseId, releases),
    [translatingIds, translatedIds, onTranslateSingle, selectedReleaseId, releases],
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

  // Batch translate handler — single CTA, published-first queue priority
  const handleTranslateAll = () => {
    if (!onTranslateBatch) return
    const untranslated = documents
      .filter((d) => !translatedIds.has(d.documentId))
      .sort((a, b) => SOURCE_STATUS_ORDER[a.sourceStatus] - SOURCE_STATUS_ORDER[b.sourceStatus])
    onTranslateBatch(
      untranslated.map((d) => d.documentId),
      untranslated.map((d) => d.documentType),
      selectedReleaseId || undefined,
    )
  }

  // Stacked progress bar segments
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
    if (sourceBreakdown.unknown > 0) {
      segments.push({
        color: 'var(--card-fg-color, #8b8d90)',
        percentage: (sourceBreakdown.unknown / totalMissing) * 100,
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

  // Progress percentage for batch CTA gradient fill
  const batchProgress =
    isTranslating && documents.length > 0 ? (translatedIds.size / documents.length) * 100 : 0

  return (
    <Stack space={4}>
      {/* Scoped header */}
      <Stack className="text-center" space={3}>
        <Heading as="h2" size={3}>
          {localeFlag} <strong>{docTypeLabel}</strong> missing in <strong>{localeName}</strong>
        </Heading>
        <Text align="center" muted size={1}>
          {totalMissing} {docTypeLabel.toLowerCase()} need translation
        </Text>
      </Stack>

      {/* Action card — source status + CTAs + release picker */}
      <Card border padding={4} radius={2}>
        <Stack space={4}>
          {/* Source status breakdown */}
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

          {/* Stacked progress bar */}
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

          {/* CTA + Release Picker */}
          <Flex align="center" gap={3} wrap="wrap">
            {!allDone && (
              <Flex direction="column" gap={2}>
                <Label size={2}>Action</Label>
                <Button
                  disabled={isTranslating}
                  fontSize={1}
                  icon={isTranslating ? SpinningIcon : TranslateIcon}
                  onClick={handleTranslateAll}
                  padding={3}
                  style={
                    isTranslating
                      ? {
                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.14) ${batchProgress}%, transparent ${batchProgress}%)`,
                        }
                      : undefined
                  }
                  text={
                    isTranslating
                      ? `Translating ${translatedIds.size} of ${documents.length}...`
                      : `Translate ${remainingCount} document${remainingCount !== 1 ? 's' : ''}${targetSuffix}`
                  }
                  tone="suggest"
                />
              </Flex>
            )}
            {!allDone && releases.length > 0 && (
              <ReleaseSelector
                disabled={isTranslating}
                onSelectRelease={setSelectedReleaseId}
                releases={releases}
                selectedRelease={selectedReleaseId}
              />
            )}
            {allDone && (
              <Card padding={3} radius={2} tone="positive">
                <Flex align="center" gap={2}>
                  <Text size={2}>
                    <CheckmarkCircleIcon />
                  </Text>
                  <Text size={1} weight="semibold">
                    All translations complete
                  </Text>
                </Flex>
              </Card>
            )}
          </Flex>
        </Stack>
      </Card>

      {/* Document table — TanStack Table */}
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

// --- Sub-components ---

function GapCloserSkeleton() {
  return (
    <Stack space={4}>
      <Stack space={2}>
        <div className="skeleton" style={{height: 28, width: 384}} />
        <div className="skeleton" style={{height: 16, width: 192}} />
      </Stack>
      <Card border padding={4} radius={2}>
        <Stack space={4}>
          <div className="skeleton" style={{height: 16, width: 128}} />
          <Flex gap={4}>
            <div className="skeleton" style={{height: 20, width: 96}} />
            <div className="skeleton" style={{height: 20, width: 80}} />
          </Flex>
          <div className="skeleton" style={{height: 4, width: '100%'}} />
          <div className="skeleton" style={{height: 40, width: 288}} />
        </Stack>
      </Card>
      <Stack space={2}>
        <div className="skeleton" style={{height: 16, width: 192}} />
        <Card border radius={2}>
          {Array.from({length: 5}).map((_, i) => (
            <Flex
              align="center"
              className="border-b border-black/[0.06]"
              gap={3}
              key={i}
              padding={3}
            >
              <div className="skeleton" style={{flex: 1, height: 16, width: '100%'}} />
              <div className="skeleton" style={{height: 24, width: 64}} />
              <div className="skeleton" style={{height: 28, width: 80}} />
            </Flex>
          ))}
        </Card>
      </Stack>
    </Stack>
  )
}

export {GapCloserSkeleton}
export default GapCloserView
