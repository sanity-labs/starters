/**
 * The inspector's chrome: identity row, close button, scrolling body.
 *
 * The identity row scrolls away with the content rather than pinning. Two
 * stacked sticky bars in a 320px column leave nothing for the diff, and the
 * pattern that solves it is GitHub's: exactly one bar pins at a time, and it
 * absorbs the identity of whatever scrolled past — here the grid's own header.
 * Children own the scroller's padding, so a sticky child can sit flush against
 * its top edge.
 *
 * Shared by both localization tiers. Only the document tier has a
 * `translation.metadata` join document to link to — the field tier keeps its
 * locales inside the subject, so it passes no metadata id and the shortcut
 * simply does not render.
 */

import {CloseIcon, DatabaseIcon, TranslateIcon} from '@sanity/icons'
import {Box, Button, Flex, Text, Tooltip} from '@sanity/ui'
import {useTranslation} from 'sanity'

import {l10nLocaleNamespace} from '../i18n'

export interface InspectorFrameProps {
  metadataId?: string | null
  onClose?: () => void
  onOpenMetadata?: (documentId: string) => void
  children: React.ReactNode
}

export function InspectorFrame({
  metadataId,
  onClose,
  onOpenMetadata,
  children,
}: InspectorFrameProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <Flex direction="column" height="fill" overflow="hidden">
      <Box flex={1} overflow="auto">
        <Flex align="center" gap={2} paddingLeft={4} paddingRight={2} paddingTop={1}>
          <Text size={1}>
            <TranslateIcon />
          </Text>
          <Text size={1} weight="medium">
            {t('translations.title')}
          </Text>
          <Box flex={1} />
          {metadataId && onOpenMetadata && (
            <Tooltip
              animate
              content={
                <Box padding={2}>
                  <Text size={1}>{t('translations.view-metadata')}</Text>
                </Box>
              }
              placement="bottom"
              portal
            >
              <Button
                aria-label={t('translations.view-metadata')}
                icon={DatabaseIcon}
                mode="bleed"
                onClick={() => onOpenMetadata(metadataId)}
              />
            </Tooltip>
          )}
          {onClose && (
            <Tooltip
              animate
              content={
                <Box padding={2}>
                  <Text size={1}>{t('close')}</Text>
                </Box>
              }
              placement="bottom"
              portal
            >
              <Button
                aria-label={t('close-inspector')}
                icon={CloseIcon}
                mode="bleed"
                onClick={onClose}
              />
            </Tooltip>
          )}
        </Flex>
        {children}
      </Box>
    </Flex>
  )
}
