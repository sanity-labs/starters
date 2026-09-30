import {timingSafeEqual} from 'node:crypto'

export type PreviewAuthResult = 'ok' | 'unauthorized' | 'misconfigured'

let warnedAboutMissingSecret = false

const isProduction = (): boolean =>
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

/**
 * Gate for the preview routes. Compares the `sanity-preview-secret` (or
 * `token`) query parameter against SANITY_PREVIEW_SECRET in constant time.
 *
 * Fails closed when the secret is unset in production: an operator who forgot
 * to configure it gets a logged `misconfigured` result instead of a publicly
 * readable preview endpoint. Outside production the missing secret is
 * tolerated so local development works without setup, with a one-time warning.
 */
export function verifyPreviewSecret(req: Request): PreviewAuthResult {
  const secret = process.env.SANITY_PREVIEW_SECRET
  if (!secret) {
    if (isProduction()) {
      console.error(
        '[preview] SANITY_PREVIEW_SECRET is not set; refusing preview requests in production',
      )
      return 'misconfigured'
    }
    if (!warnedAboutMissingSecret) {
      console.warn(
        '[preview] SANITY_PREVIEW_SECRET is not set; allowing unauthenticated previews because this is not a production build',
      )
      warnedAboutMissingSecret = true
    }
    return 'ok'
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('sanity-preview-secret') ?? url.searchParams.get('token')
  if (!token) return 'unauthorized'

  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'unauthorized'
}

/**
 * Maps a failed {@link verifyPreviewSecret} result to the response a route
 * should send: 401 for a missing or wrong token, 500 when the server itself is
 * misconfigured. The reason stays in the server log, not the response body.
 */
export function previewAuthErrorResponse(result: Exclude<PreviewAuthResult, 'ok'>): Response {
  if (result === 'misconfigured') return new Response('Preview unavailable', {status: 500})
  return new Response('Unauthorized', {status: 401})
}

export const PREVIEW_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}
