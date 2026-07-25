/**
 * @starter/l10n/translate
 *
 * Post-translation document shaping — slug generation, field cleanup and image
 * crop/hotspot restoration. Shared by the translations dashboard and the
 * `translate-locale` effect handler so a translated document comes out the same
 * shape whichever surface produced it.
 *
 * React-free, like `./core`: no `sanity`, no `@sanity/ui`, no plugins.
 */

export {generateLocalizedSlug} from './generateLocalizedSlug'
export {
  isSanityImageField,
  restoreImageCropHotspot,
  type SanityImageCrop,
  type SanityImageField,
  type SanityImageHotspot,
} from './imageUtils'
export {postProcessTranslation, type SourceDocumentReader} from './postTranslationProcessing'
