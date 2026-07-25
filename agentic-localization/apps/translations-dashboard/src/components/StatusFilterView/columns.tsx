import {WarningOutlineIcon} from '@sanity/icons'
import {Badge, Box, Button, Flex, Text, Tooltip} from '@sanity/ui'
import {createColumnHelper} from '@tanstack/react-table'
import {useNavigate} from 'react-router-dom'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'
import type {DashboardStatus} from '../../lib/localizationRun'

import {documentTypeLabels} from '../../consts/documentInternationalization'
import {formatDocId} from '../../lib/utils'
import OpenInStudioButton from '../OpenInStudioButton'

function getDocTypeLabel(type: string): string {
  return documentTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

/** Status-contextual column header for the locales column */
export const LOCALE_COLUMN_LABELS: Record<DashboardStatus, string> = {
  approved: 'Approved Locales',
  missing: 'Missing Locales',
  needsReview: 'Locales to Review',
  stale: 'Stale Locales',
  translating: 'Locales in Progress',
  usingFallback: 'Fallback Locales',
}

const columnHelper = createColumnHelper<StatusFilteredDocument>()

/** A row inside an open run links to it; everything else links to Studio. */
function RowAction({doc}: {doc: StatusFilteredDocument}) {
  const navigate = useNavigate()
  const instanceId = doc.instanceId

  if (!instanceId) {
    return (
      <OpenInStudioButton
        doc={{documentId: doc._id, documentType: doc._type}}
        mode="bleed"
        title="Open in Studio"
      />
    )
  }

  return (
    <Button
      fontSize={1}
      mode="bleed"
      onClick={() => navigate(`/runs/${instanceId}`)}
      padding={2}
      text="View run"
    />
  )
}

export function buildColumns(status: DashboardStatus) {
  return [
    columnHelper.accessor((row) => row.title || formatDocId(row._id, true), {
      cell: (info) => (
        <Flex align="center" gap={2}>
          <Text size={1} weight="medium">
            {info.getValue()}
          </Text>
          {/* Partial failure is surfaced, never blocking. */}
          {info.row.original.hasFailedLocales && (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={0}>A locale in this run failed</Text>
                </Box>
              }
              placement="top"
              portal
            >
              <Text size={1} style={{color: 'var(--card-critical-fg-color)'}}>
                <WarningOutlineIcon />
              </Text>
            </Tooltip>
          )}
        </Flex>
      ),
      header: 'Document',
      id: 'document',
    }),
    columnHelper.accessor((row) => getDocTypeLabel(row._type), {
      cell: (info) => (
        <Badge fontSize={2} padding={2} tone="primary">
          {info.getValue()}
        </Badge>
      ),
      header: 'Type',
      id: 'type',
    }),
    columnHelper.accessor((row) => row.locales.length, {
      cell: (info) => (
        <Flex gap={1} wrap="wrap">
          {info.row.original.locales.map((locale) => (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={0}>{locale.name}</Text>
                </Box>
              }
              key={locale.tag}
              placement="top"
              portal
            >
              <Badge fontSize={2} padding={2} tone="critical">
                {locale.tag}
              </Badge>
            </Tooltip>
          ))}
        </Flex>
      ),
      header: LOCALE_COLUMN_LABELS[status],
      id: 'locales',
    }),
    columnHelper.display({
      cell: (info) => <RowAction doc={info.row.original} />,
      enableSorting: false,
      header: '',
      id: 'action',
    }),
  ]
}
