import {describe, expect, it} from 'vitest'
import {perspectiveCookieName} from '@sanity/preview-url-secret/constants'
import {isDraftModeRequest, getPerspectiveFromCookies} from './draft-mode'

describe('draft-mode helpers', () => {
  it('detects draft mode cookie', () => {
    expect(isDraftModeRequest({'sanity-draft-mode': 'true'})).toBe(true)
    expect(isDraftModeRequest({'sanity-draft-mode': 'false'})).toBe(false)
    expect(isDraftModeRequest({})).toBe(false)
  })

  it('reads perspective cookie', () => {
    expect(getPerspectiveFromCookies({[perspectiveCookieName]: 'drafts'})).toBe('drafts')
    expect(getPerspectiveFromCookies({})).toBeUndefined()
  })
})
