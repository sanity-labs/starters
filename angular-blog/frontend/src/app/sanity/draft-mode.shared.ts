import {perspectiveCookieName} from '@sanity/preview-url-secret/constants'

export const DRAFT_MODE_COOKIE = 'sanity-draft-mode'

export function isDraftModeRequest(cookies: Record<string, string | undefined>): boolean {
  return cookies[DRAFT_MODE_COOKIE] === 'true'
}

export function getPerspectiveFromCookies(
  cookies: Record<string, string | undefined>,
): string | undefined {
  return cookies[perspectiveCookieName]
}

export function isDraftModeBrowser(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes(`${DRAFT_MODE_COOKIE}=true`)
}
