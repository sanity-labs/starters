/**
 * Promotion plugin — artifact schema, emailSlot type, workflow integration, and refinement UI
 *
 * Promotions are segment-targeted artifacts — one per segment per campaign.
 * Each references the campaign brief and a segment.
 */

export {promotion} from './schemaTypes/promotion'
export {emailSlot} from './schemaTypes/emailSlot'
export {ApproveAction} from './documentActions/ApproveAction'
export {ResendAction} from './documentActions/ResendAction'
export {WorkflowStateBadge} from './badges/WorkflowStateBadge'
export {SegmentBadge} from './badges/SegmentBadge'
export {RefinementInspector} from './inspector/RefinementInspector'
export {PreviewStatusInspector} from './inspector/PreviewStatusInspector'
