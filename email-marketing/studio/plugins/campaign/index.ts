/**
 * Campaign plugin — brief schema, document actions, and CampaignGrid view
 *
 * The campaign is the governed unit of work: goals, messaging, audience segments,
 * launch window, and references to evergreen content are authored here.
 * Promotions (artifacts) inherit from the brief by reference.
 */

export {campaign} from './schemaTypes/campaign'
export {GenerateVariantsAction} from './documentActions/GenerateVariantsAction'
export {CampaignGridView} from './views/CampaignGridView'
