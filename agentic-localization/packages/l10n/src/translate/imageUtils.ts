/**
 * Utilities for preserving Sanity image crop/hotspot metadata
 * during translation operations.
 *
 * When the translate agent creates a new document, it may leave
 * crop/hotspot fields empty. These helpers deep-copy the values
 * from the base document so published images stay correctly framed.
 */

import type {SanityImageCrop, SanityImageHotspot} from '@sanity/asset-utils'
import type {Image} from '@sanity/types'

import {DEFAULT_CROP, DEFAULT_HOTSPOT, isDefaultCrop, isDefaultHotspot} from '@sanity/asset-utils'

import {isRecord} from '../core/isRecord'

const CROP_KEYS = Object.keys(DEFAULT_CROP)
const HOTSPOT_KEYS = Object.keys(DEFAULT_HOTSPOT)

/**
 * Not `@sanity/types`' `isImage`: that keys on the asset reference
 * (`asset._ref` starting `image-`), and the node this walker exists for is
 * translate output that dropped its image metadata — `_type` is all it is
 * guaranteed to carry.
 */
export function isSanityImageField(value: unknown): value is Image {
  return isRecord(value) && value._type === 'image'
}

function readCrop(value: unknown): SanityImageCrop | undefined {
  if (!isRecord(value)) return undefined
  const {top, bottom, left, right} = value
  if (
    typeof top !== 'number' ||
    typeof bottom !== 'number' ||
    typeof left !== 'number' ||
    typeof right !== 'number'
  ) {
    return undefined
  }
  return {top, bottom, left, right}
}

function readHotspot(value: unknown): SanityImageHotspot | undefined {
  if (!isRecord(value)) return undefined
  const {x, y, width, height} = value
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return undefined
  }
  return {x, y, width, height}
}

/**
 * Does this region frame the image at all?
 *
 * Two shapes mean "no". The one the translate agent leaves behind: keys absent
 * or explicitly null. And the one it echoes: a region equal to
 * `@sanity/asset-utils`' default, which _is_ the whole image — a zeroed crop
 * crops nothing, a centred full-size hotspot focuses nothing. Ours used to test
 * only the first, so an echoed default overwrote framing a person had chosen
 * with itself. Restoring is the safe branch for both: the fallback is the base
 * document's own framing, never a guess.
 */
function framesWithCrop(region: unknown): boolean {
  if (!isRecord(region)) return false
  if (CROP_KEYS.every((key) => region[key] == null)) return false
  const parsed = readCrop(region)
  // Partially written — not the default, and not nothing either.
  return parsed ? !isDefaultCrop(parsed) : true
}

function framesWithHotspot(region: unknown): boolean {
  if (!isRecord(region)) return false
  if (HOTSPOT_KEYS.every((key) => region[key] == null)) return false
  const parsed = readHotspot(region)
  return parsed ? !isDefaultHotspot(parsed) : true
}

/**
 * Recursively walk `translated` and copy crop/hotspot from the corresponding
 * `base` node whenever the translated version frames nothing.
 */
export function restoreImageCropHotspot(base: unknown, translated: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(translated)) {
    return translated.map((tItem, i) => restoreImageCropHotspot(base[i], tItem))
  }

  if (isRecord(base) && isRecord(translated)) {
    if (isSanityImageField(translated)) {
      const baseImg = isSanityImageField(base) ? base : null

      if (baseImg) {
        if (!framesWithCrop(translated.crop) && framesWithCrop(baseImg.crop)) {
          translated.crop = baseImg.crop
        }
        if (!framesWithHotspot(translated.hotspot) && framesWithHotspot(baseImg.hotspot)) {
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
