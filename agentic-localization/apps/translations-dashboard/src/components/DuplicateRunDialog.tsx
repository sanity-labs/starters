/**
 * The duplicate-run pre-check.
 *
 * Deliberately not an engine start requirement: `localize-document` declares
 * `singleSubject`, so a busy document refuses its own start — but making that a
 * batch-level gate would fail the whole batch because one document is busy.
 * The operator is the authority, so the batch asks.
 */

import {Box, Button, Card, Dialog, Flex, Stack, Text} from '@sanity/ui'

interface DuplicateRunDialogProps {
  onCancel: () => void
  /** Start everything: a busy document's run is ticked instead of duplicated. */
  onTakeOver: () => void
  /** Leave the busy documents alone and start the rest. */
  onSkip: () => void
  runningCount: number
  totalCount: number
}

function DuplicateRunDialog({
  onCancel,
  onSkip,
  onTakeOver,
  runningCount,
  totalCount,
}: DuplicateRunDialogProps) {
  const remaining = totalCount - runningCount

  return (
    <Dialog
      header="Some of these are already being localized"
      id="duplicate-run-dialog"
      onClose={onCancel}
      width={1}
    >
      <Box padding={4}>
        <Stack space={4}>
          <Text size={1}>
            {runningCount} of {totalCount} selected document{totalCount === 1 ? '' : 's'} already
            {runningCount === 1 ? ' has' : ' have'} an open localization run.
          </Text>
          <Card padding={3} radius={2} tone="transparent">
            <Text muted size={1}>
              Taking over does not start a second run — it advances the existing one so it picks up
              the current revision.
            </Text>
          </Card>
          <Flex gap={2} justify="flex-end">
            <Button fontSize={1} mode="bleed" onClick={onCancel} padding={3} text="Cancel" />
            <Button
              disabled={remaining === 0}
              fontSize={1}
              mode="ghost"
              onClick={onSkip}
              padding={3}
              text={`Skip them — start ${remaining}`}
            />
            <Button
              fontSize={1}
              onClick={onTakeOver}
              padding={3}
              text="Take over all"
              tone="suggest"
            />
          </Flex>
        </Stack>
      </Box>
    </Dialog>
  )
}

export default DuplicateRunDialog
