/**
 * Post-translation document shaping — slug generation, field cleanup and image
 * crop/hotspot restoration, so a translated document comes out the same shape
 * whichever surface produced it.
 *
 * Internal: no export entry points here. The only consumer is the
 * `translate-locale` handler. Promote it to an entry if a second one appears.
 */

export {generateLocalizedSlug} from './generateLocalizedSlug'
export {isSanityImageField, restoreImageCropHotspot} from './imageUtils'
export {postProcessTranslation, type SourceDocumentReader} from './postTranslationProcessing'
