/**
 * Side-by-side compare for one locale: the translation the run just wrote
 * against the one currently published.
 *
 * The engine writes into a draft, or into a version when the run belongs to a
 * release, so "what changed" is the delta between the published document and
 * whichever of those is pending. Both localization tiers land here: `locale`
 * marks a field-tier compare, where the translation lives in the subject's own
 * internationalized arrays and `compareSides` reduces each side to that
 * locale's values. Diff rendering reuses the pure diff components; editing
 * hands the reviewer the field in the real editor rather than re-implementing
 * one here.
 *
 * Not the Studio's own review-changes tree. `sanity` does export `ChangeList`,
 * `ChangeResolver`, `DiffCard`, `DiffTooltip`, `useDocumentChange` and
 * `resolveDiffComponent`, and adopting them would delete most of this file — but
 * every one of them is marked `@internal` in `sanity@6.6.0`'s `.d.ts` despite
 * being publicly exported, so none carries a stability guarantee on a host that
 * ships weekly. The disqualifier is structural rather than a version worry:
 * `ChangeListProps.schemaType` is an `ObjectSchemaType`, and the field tier's
 * side of the compare is `compareSides`' locale-reduced projection — a flat map
 * keyed by dotted paths (`seo.metaTitle`) holding one locale's scalar values.
 * No compiled schema type has those fields, and handing `ChangeList` the real
 * `person` type instead would put every locale's array entries back on screen,
 * which is exactly what the projection exists to remove.
 *
 * What we did take is the stable half of the same machinery: `@sanity/diff` is
 * `@public`, and `core/textDiff` reads its `StringDiff`/`ArrayDiff` directly.
 * This file renders those segments; it no longer computes any.
 */

import {EditIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {getPublishedId, useEditState} from 'sanity'

import {
  compareSides,
  computeFieldChanges,
  type FieldChange,
  type FieldChangeMagnitude,
} from '@starter/l10n'
import {ArrayDiffSummary, InlineDiff, SimpleValueDiff} from './InlineDiff'
import {PortableTextDiff} from './PortableTextDiff'

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

export interface TranslationCompareProps {
  /** The document holding this locale's translation — a sibling, or the subject itself. */
  documentId: string
  documentType: string
  /** Field tier only: the locale whose entries in `documentId` the run wrote. */
  locale?: string
  /** Set when the run writes into a release rather than a draft. */
  releaseName?: string
  /** Open this field in the document editor, as a form path. */
  onEditField?: (fieldPath: string) => void
}

function FieldDiff({change}: {change: FieldChange}) {
  const {fieldType, oldValue, newValue} = change

  if (fieldType === 'portableText' && Array.isArray(oldValue) && Array.isArray(newValue)) {
    return <PortableTextDiff oldBlocks={oldValue} newBlocks={newValue} />
  }
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    return <InlineDiff oldValue={oldValue} newValue={newValue} />
  }
  if (fieldType === 'array' || fieldType === 'portableText') {
    return <ArrayDiffSummary oldValue={oldValue} newValue={newValue} />
  }
  return <SimpleValueDiff oldValue={oldValue} newValue={newValue} />
}

export function TranslationCompare({
  documentId,
  documentType,
  locale,
  releaseName,
  onEditField,
}: TranslationCompareProps) {
  const publishedId = getPublishedId(documentId)
  const editState = useEditState(publishedId, documentType, 'default', releaseName)

  if (!editState.ready) {
    return (
      <Flex align="center" gap={2} padding={3}>
        <Spinner muted />
        <Text size={1} muted>
          Loading translation…
        </Text>
      </Flex>
    )
  }

  const pending = editState.version ?? editState.draft
  if (!pending) {
    return (
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>
          Nothing pending — the published translation is what the run produced.
        </Text>
      </Card>
    )
  }

  const sides = compareSides({
    documentType,
    locale,
    published: editState.published,
    pending,
  })
  const changes = computeFieldChanges(sides.published, sides.pending).filter(
    (change) => change.changed,
  )

  if (changes.length === 0) {
    return (
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>
          No field differs from the published translation.
        </Text>
      </Card>
    )
  }

  return (
    <Stack space={3}>
      <Text size={1} muted>
        {releaseName
          ? `Comparing the ${releaseName} version against the published translation.`
          : 'Comparing the pending draft against the published translation.'}
      </Text>
      {changes.map((change) => (
        <Card key={change.fieldName} padding={3} radius={2} border>
          <Stack space={3}>
            <Flex align="center" gap={2}>
              <Text size={1} weight="semibold">
                {change.fieldName}
              </Text>
              <Badge fontSize={0} mode="outline" tone={MAGNITUDE_TONE[change.magnitude]}>
                {change.magnitude}
              </Badge>
              <Box flex={1} />
              {onEditField && (
                <Button
                  fontSize={0}
                  icon={EditIcon}
                  mode="bleed"
                  onClick={() => onEditField(sides.editPaths[change.fieldName] ?? change.fieldName)}
                  padding={2}
                  text="Edit"
                />
              )}
            </Flex>
            <FieldDiff change={change} />
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
