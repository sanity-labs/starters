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

export function parseCookieHeader(cookieHeader: string | null): Record<string, string | undefined> {
  if (!cookieHeader) return {}

  const cookies: Record<string, string | undefined> = {}
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies[name] = decodeURIComponent(rest.join('=') || '')
  }
  return cookies
}

/** Read cookies from Angular's injected Fetch API `Request` (SSR). */
export function cookiesFromRequest(
  request: Request | null | undefined,
): Record<string, string | undefined> {
  return parseCookieHeader(request?.headers.get('cookie') ?? null)
}
