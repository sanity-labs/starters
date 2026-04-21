/**
 * Promotion plugin — artifact schema, emailSlot type, workflow integration, and refinement UI
 *
 * Promotions are the segment-variant artifacts. Base promotion + N segment-variant
 * promotions per campaign. Each references the brief and a segment.
 */

export {promotion} from './schemaTypes/promotion'
export {emailSlot} from './schemaTypes/emailSlot'
export {ApproveAction} from './documentActions/ApproveAction'
export {ResendAction} from './documentActions/ResendAction'
export {WorkflowStateBadge} from './badges/WorkflowStateBadge'
export {SegmentBadge} from './badges/SegmentBadge'
export {RefinementInspector} from './inspector/RefinementInspector'
export {PreviewStatusInspector} from './inspector/PreviewStatusInspector'
