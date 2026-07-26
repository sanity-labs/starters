export {localizeCampaign} from './localizeCampaign'
export {localizeDocument} from './localizeDocument'
export {localizeLocale} from './localizeLocale'

export {ANALYZE_SOURCE, EFFECT_NAMES, PUBLISH_RELEASE, TRANSLATE_LOCALE} from './effects'
export type {EffectName} from './effects'

export {
  APPROVED_STAGE,
  FAILED_STAGE,
  IN_PROGRESS_STAGES,
  REVIEW_STAGE,
  runPhase,
  SETTLED_STAGES,
} from './stages'
export type {LocalizeDocumentStage, RunPhase} from './stages'

export {
  ENGINE_API_VERSION,
  SOURCE_LANGUAGE,
  WORKFLOW_TAG,
  WORKFLOWS_DATASET,
  workflowsResource,
} from './config'
export {projectResourceClients} from './resourceClients'
export type {ProjectResourceClients} from './resourceClients'

import {localizeCampaign} from './localizeCampaign'
import {localizeDocument} from './localizeDocument'
import {localizeLocale} from './localizeLocale'

/**
 * Every definition, in dependency order. Deploy takes the whole set in one call:
 * a parent cannot spawn a child that is not deployed.
 */
export const localizationWorkflows = [localizeLocale, localizeDocument, localizeCampaign]
