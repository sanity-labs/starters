export {localizeCampaign} from './localizeCampaign'
export {localizeDocument} from './localizeDocument'
export {localizeLocale} from './localizeLocale'

export {
  ANALYZE_SOURCE,
  APPROVED_STAGE,
  EFFECT_NAMES,
  PUBLISH_RELEASE,
  SOURCE_LANGUAGE,
  TRANSLATE_LOCALE,
} from './effects'
export type {EffectName} from './effects'

export {WORKFLOW_TAG, WORKFLOWS_DATASET} from './config'
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
