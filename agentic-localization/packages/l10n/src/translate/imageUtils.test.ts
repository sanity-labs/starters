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

  it('restores over a crop the machine echoed at the default', () => {
    // `{top:0,bottom:0,left:0,right:0}` is `@sanity/asset-utils`' DEFAULT_CROP —
    // it crops nothing. Key-absence alone read this as framing and kept it,
    // dropping the framing a person had chosen.
    const base = {cover: {_type: 'image', crop: CROP}}
    const translated = {
      cover: {
        _type: 'image',
        crop: {_type: 'sanity.imageCrop', top: 0, bottom: 0, left: 0, right: 0},
      },
    }

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', crop: CROP},
    })
  })

  it('restores over a hotspot the machine echoed at the default', () => {
    // DEFAULT_HOTSPOT is the centred, full-size region — it focuses nothing.
    const base = {cover: {_type: 'image', hotspot: HOTSPOT}}
    const translated = {
      cover: {
        _type: 'image',
        hotspot: {_type: 'sanity.imageHotspot', x: 0.5, y: 0.5, width: 1, height: 1},
      },
    }

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', hotspot: HOTSPOT},
    })
  })

  it('keeps a default crop when the base frames nothing either', () => {
    const defaultCrop = {_type: 'sanity.imageCrop', top: 0, bottom: 0, left: 0, right: 0}
    const base = {cover: {_type: 'image'}}
    const translated = {cover: {_type: 'image', crop: defaultCrop}}

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', crop: defaultCrop},
    })
  })

  it('keeps a partially written crop, which is neither absent nor the default', () => {
    const partial = {_type: 'sanity.imageCrop', top: 0, bottom: 0}
    const base = {cover: {_type: 'image', crop: CROP}}
    const translated = {cover: {_type: 'image', crop: partial}}

    expect(restoreImageCropHotspot(base, translated)).toEqual({
      cover: {_type: 'image', crop: partial},
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
