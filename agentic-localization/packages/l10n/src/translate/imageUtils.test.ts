import {describe, expect, it} from 'vitest'

import {restoreImageCropHotspot} from './imageUtils'

const CROP = {_type: 'sanity.imageCrop', top: 0.1, bottom: 0.2, left: 0, right: 0}
const HOTSPOT = {_type: 'sanity.imageHotspot', x: 0.5, y: 0.5, width: 0.4, height: 0.4}

describe('restoreImageCropHotspot', () => {
  it('copies crop and hotspot onto a translated image that lost them', () => {
    const base = {cover: {_type: 'image', crop: CROP, hotspot: HOTSPOT}}
    const translated = {cover: {_type: 'image'}}

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', crop: CROP, hotspot: HOTSPOT},
    })
  })

  it('leaves a crop the translation already carries alone', () => {
    const ownCrop = {_type: 'sanity.imageCrop', top: 0.9}
    const base = {cover: {_type: 'image', crop: CROP}}
    const translated = {cover: {_type: 'image', crop: ownCrop}}

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', crop: ownCrop},
    })
  })

  it('treats an all-null hotspot as empty', () => {
    const base = {cover: {_type: 'image', hotspot: HOTSPOT}}
    const translated = {
      cover: {_type: 'image', hotspot: {_type: 'sanity.imageHotspot', x: null, y: null}},
    }

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', hotspot: HOTSPOT},
    })
  })

  it('walks arrays element-wise', () => {
    const base = {blocks: [{_type: 'image', crop: CROP}]}
    const translated = {blocks: [{_type: 'image'}]}

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      blocks: [{_type: 'image', crop: CROP}],
    })
  })

  it('returns the translated value untouched when there is no base counterpart', () => {
    expect(restoreImageCropHotspot(undefined, {title: 'x'})).toEqual({title: 'x'})
    expect(restoreImageCropHotspot(null, 'plain')).toBe('plain')
  })
})
