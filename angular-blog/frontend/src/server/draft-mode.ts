import {createClient, type SanityClient} from '@sanity/client'
import {validatePreviewUrl} from '@sanity/preview-url-secret'
import {perspectiveCookieName} from '@sanity/preview-url-secret/constants'
import {withoutSecretSearchParams} from '@sanity/preview-url-secret/without-secret-search-params'
import type {Request, Response} from 'express'
import {DRAFT_MODE_COOKIE} from '../app/sanity/draft-mode.shared'
import {getServerEnv} from './env'

export {
  DRAFT_MODE_COOKIE,
  getPerspectiveFromCookies,
  isDraftModeRequest,
} from '../app/sanity/draft-mode.shared'

export function createServerSanityClient(token?: string): SanityClient {
  const env = getServerEnv()
  return createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: '2025-03-01',
    useCdn: false,
    token,
    stega: {enabled: false},
  })
}

function clientCookieFlags(secure: boolean): string {
  const parts = ['Path=/', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function httpOnlyCookieFlags(secure: boolean): string {
  return `HttpOnly; ${clientCookieFlags(secure)}`
}

export async function handleDraftModeEnable(req: Request, res: Response): Promise<void> {
  const env = getServerEnv()
  if (!env.readToken) {
    res.status(500).send('SANITY_API_READ_TOKEN is not configured')
    return
  }

  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const client = createServerSanityClient(env.readToken)
  const {isValid, redirectTo, studioPreviewPerspective} = await validatePreviewUrl(client, fullUrl)

  if (!isValid) {
    res.status(401).send('Invalid or expired preview secret')
    return
  }

  const perspective = studioPreviewPerspective ?? 'drafts'
  const secure = req.secure || req.get('x-forwarded-proto') === 'https'
  const cleanPath = redirectTo
    ? withoutSecretSearchParams(new URL(redirectTo, fullUrl)).pathname
    : '/'

  res.setHeader('Set-Cookie', [
    `${DRAFT_MODE_COOKIE}=true; ${clientCookieFlags(secure)}; Max-Age=3600`,
    `${perspectiveCookieName}=${encodeURIComponent(perspective)}; ${httpOnlyCookieFlags(secure)}; Max-Age=3600`,
  ])
  res.redirect(307, cleanPath)
}

export function handleDraftModeDisable(_req: Request, res: Response): void {
  const secure = _req.secure || _req.get('x-forwarded-proto') === 'https'
  const expired = `Max-Age=0; ${clientCookieFlags(secure)}`
  res.setHeader('Set-Cookie', [
    `${DRAFT_MODE_COOKIE}=; ${expired}`,
    `${perspectiveCookieName}=; Max-Age=0; ${httpOnlyCookieFlags(secure)}`,
  ])
  res.redirect(307, '/')
}

export function handleDraftModePerspective(req: Request, res: Response): void {
  const current = req.cookies?.[perspectiveCookieName] as string | undefined
  const next = (req.query['perspective'] as string | undefined) ?? 'drafts'

  if (current === next) {
    res.status(204).end()
    return
  }

  const secure = req.secure || req.get('x-forwarded-proto') === 'https'
  res.setHeader(
    'Set-Cookie',
    `${perspectiveCookieName}=${encodeURIComponent(next)}; ${httpOnlyCookieFlags(secure)}; Max-Age=3600`,
  )
  res.status(200).json({reload: true})
}
