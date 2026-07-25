/**
 * Where a batch ships.
 *
 * Drafts means one `localize-document` run per document. A release — picked or
 * minted here — means one `localize-campaign` over the batch, which is what
 * makes the documents ship together.
 */

import type {ReleaseDocument} from '@sanity/sdk'

import {Flex, Label, Select, Stack, TextInput} from '@sanity/ui'

import type {CampaignTarget} from '../hooks/useStartLocalization'

const NEW_RELEASE = '__new__'

interface ReleaseSelectorProps {
  disabled?: boolean
  onChange: (target: CampaignTarget) => void
  releases: ReleaseDocument[]
  value: CampaignTarget
}

function defaultTitle(): string {
  return `Localization ${new Date().toISOString().slice(0, 10)}`
}

function selectValue(target: CampaignTarget): string {
  if (target.kind === 'existing') return target.releaseName
  if (target.kind === 'new') return NEW_RELEASE
  return ''
}

function ReleaseSelector({disabled, onChange, releases, value}: ReleaseSelectorProps) {
  return (
    <Stack space={2}>
      <Label size={2}>Ships as</Label>
      <Flex gap={2}>
        <Select
          disabled={disabled}
          fontSize={2}
          onChange={(event) => {
            const next = event.currentTarget.value
            if (next === '') return onChange({kind: 'drafts'})
            if (next === NEW_RELEASE) return onChange({kind: 'new', title: defaultTitle()})
            return onChange({kind: 'existing', releaseName: next})
          }}
          padding={3}
          radius={3}
          value={selectValue(value)}
        >
          <option value="">Drafts — one run per document</option>
          {releases.map((release) => (
            <option key={release.name} value={release.name}>
              Campaign → {release.metadata.title || release.name}
            </option>
          ))}
          <option value={NEW_RELEASE}>Campaign → new release…</option>
        </Select>
        {value.kind === 'new' && (
          <TextInput
            aria-label="New release title"
            disabled={disabled}
            fontSize={2}
            onChange={(event) => onChange({kind: 'new', title: event.currentTarget.value})}
            padding={3}
            radius={3}
            value={value.title}
          />
        )}
      </Flex>
    </Stack>
  )
}

export default ReleaseSelector
