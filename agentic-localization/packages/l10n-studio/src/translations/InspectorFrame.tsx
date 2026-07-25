/**
 * The inspector's chrome: title bar, close button, scrolling body.
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
      <Flex
        align="center"
        flex="none"
        gap={2}
        paddingLeft={4}
        paddingRight={2}
        paddingTop={1}
        style={{position: 'relative', zIndex: 1}}
      >
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
      <Box flex={1} overflow="auto" padding={3}>
        {children}
      </Box>
    </Flex>
  )
}
