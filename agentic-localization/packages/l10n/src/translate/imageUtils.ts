/**
 * Utilities for preserving Sanity image crop/hotspot metadata
 * during translation operations.
 *
 * When the translate agent creates a new document, it may leave
 * crop/hotspot fields empty. These helpers deep-copy the values
 * from the base document so published images stay correctly framed.
 */

import type {Image} from '@sanity/types'

import {isRecord} from '../core/isRecord'

const HOTSPOT_KEYS = ['x', 'y', 'width', 'height'] as const

/**
 * Not `@sanity/types`' `isImage`: that keys on the asset reference
 * (`asset._ref` starting `image-`), and the node this walker exists for is
 * translate output that dropped its image metadata — `_type` is all it is
 * guaranteed to carry.
 */
export function isSanityImageField(value: unknown): value is Image {
  return isRecord(value) && value._type === 'image'
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

  if (isRecord(base) && isRecord(translated)) {
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
          !translated.hotspot || HOTSPOT_KEYS.every((k) => translated.hotspot?.[k] == null)
        if (hotspotEmpty && baseImg.hotspot) {
          translated.hotspot = baseImg.hotspot
        }
      }

      return translated
    }

    const out: Record<string, unknown> = {...translated}
    for (const key of Object.keys(out)) {
      out[key] = restoreImageCropHotspot(base[key], out[key])
    }
    return out
  }

  return translated
}
