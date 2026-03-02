import type {TranslationWorkflowStatus} from '@starter/l10n'

import {Badge, Box, Flex, Text, Tooltip} from '@sanity/ui'
import {createColumnHelper} from '@tanstack/react-table'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'

import {formatDocId} from '../../lib/utils'
import {documentTypeLabels} from '../DocumentTypeSelector'
import OpenInStudioButton from '../OpenInStudioButton'

function getDocTypeLabel(type: string): string {
  return documentTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

/** Status-contextual column header for the locales column */
export const LOCALE_COLUMN_LABELS: Record<TranslationWorkflowStatus, string> = {
  approved: 'Approved Locales',
  missing: 'Missing Locales',
  needsReview: 'Locales to Review',
  stale: 'Stale Locales',
  usingFallback: 'Fallback Locales',
}

const columnHelper = createColumnHelper<StatusFilteredDocument>()

export function buildColumns(status: TranslationWorkflowStatus) {
  return [
    columnHelper.accessor((row) => row.title || formatDocId(row._id, true), {
      cell: (info) => (
        <Text size={1} weight="medium">
          {info.getValue()}
        </Text>
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
      cell: (info) => (
        <OpenInStudioButton
          doc={{
            documentId: info.row.original._id,
            documentType: info.row.original._type,
          }}
          mode="bleed"
          title="Open in Studio"
        />
      ),
      enableSorting: false,
      header: '',
      id: 'action',
    }),
  ]
}
