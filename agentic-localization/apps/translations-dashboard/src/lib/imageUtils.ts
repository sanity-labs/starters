/**
 * Utilities for preserving Sanity image crop/hotspot metadata
 * during translation operations.
 *
 * When the translate agent creates a new document, it may leave
 * crop/hotspot fields empty. These helpers deep-copy the values
 * from the base document so published images stay correctly framed.
 */

export type SanityImageCrop = {
  _type: 'sanity.imageCrop'
  bottom?: number
  left?: number
  right?: number
  top?: number
}

export type SanityImageField = {
  _type: 'image'
  [key: string]: unknown
  crop?: SanityImageCrop
  hotspot?: SanityImageHotspot
}

export type SanityImageHotspot = {
  _type: 'sanity.imageHotspot'
  height?: null | number
  width?: null | number
  x?: null | number
  y?: null | number
}

export function isSanityImageField(obj: unknown): obj is SanityImageField {
  return typeof obj === 'object' && obj !== null && '_type' in obj && obj._type === 'image'
}

/**
 * Recursively walk `translated` and copy crop/hotspot from
 * the corresponding `base` node whenever the translated version
 * has empty or null values.
 */
export function restoreImageCropHotspot(base: unknown, translated: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(translated)) {
    return translated.map((tItem, i) => restoreImageCropHotspot(base[i], tItem))
  }

  if (base && translated && typeof base === 'object' && typeof translated === 'object') {
    if (isSanityImageField(translated)) {
      const baseImg = isSanityImageField(base) ? base : null

      if (baseImg) {
        if (
          !translated.crop ||
          Object.keys(translated.crop).filter((k) => k !== '_type').length === 0
        ) {
          if (baseImg.crop && Object.keys(baseImg.crop).length > 0) {
            translated.crop = baseImg.crop
          }
        }

        const hotspotEmpty =
          !translated.hotspot ||
          ['x', 'y', 'width', 'height'].every(
            (k) => translated.hotspot?.[k as keyof SanityImageHotspot] == null,
          )
        if (hotspotEmpty && baseImg.hotspot) {
          translated.hotspot = baseImg.hotspot
        }
      }

      return translated
    }

    const out: Record<string, unknown> = {...(translated as Record<string, unknown>)}
    for (const key of Object.keys(out)) {
      out[key] = restoreImageCropHotspot((base as Record<string, unknown>)[key], out[key])
    }
    return out
  }

  return translated
}
