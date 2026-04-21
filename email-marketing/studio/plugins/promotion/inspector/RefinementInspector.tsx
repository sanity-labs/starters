import {SparklesIcon} from '@sanity/icons'
import {defineDocumentInspector, type DocumentInspectorProps} from 'sanity'
import {VariantRefinementPanel} from '../components/VariantRefinementPanel'

function RefinementInspectorComponent({documentId}: DocumentInspectorProps) {
  const promotionId = documentId.replace(/^drafts\./, '')
  return <VariantRefinementPanel promotionId={promotionId} />
}

export const RefinementInspector = defineDocumentInspector({
  name: 'promotion-refinement',
  useMenuItem() {
    return {title: 'Refine with AI', icon: SparklesIcon}
  },
  component: RefinementInspectorComponent,
})
