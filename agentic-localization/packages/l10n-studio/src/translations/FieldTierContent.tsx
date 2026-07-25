/**
 * Field-level translation inspector.
 *
 * Same surface as the document tier, one document short. A `person` keeps every
 * locale in its own internationalized arrays, so there is no sibling document to
 * navigate to and no `translation.metadata` to open — but the run is the same
 * `localize-document` run, the tiers reduce to the same (locale, field) pairs
 * through `compareSides`, and `ReviewMatrix` renders both. What differs is
 * parameterised inside it: the columns come from the schema rather than from the
 * run, a cell can be genuinely missing rather than the whole row, and a jump is
 * a focus move within this form rather than a pane to the right.
 */

import {ErrorBoundary} from './ErrorBoundary'
import {ReviewMatrix} from './ReviewMatrix'

export interface FieldTierContentProps {
  documentId: string
  documentType: string
  defaultLanguage: string | undefined
  onClose?: () => void
}

export function FieldTierContent({
  documentId,
  documentType,
  defaultLanguage,
  onClose,
}: FieldTierContentProps) {
  return (
    <ErrorBoundary featureName="Translation Inspector">
      <ReviewMatrix
        defaultLanguage={defaultLanguage}
        documentId={documentId}
        documentType={documentType}
        onClose={onClose}
      />
    </ErrorBoundary>
  )
}
