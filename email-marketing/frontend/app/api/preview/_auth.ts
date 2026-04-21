import {timingSafeEqual} from 'node:crypto'

/**
 * Verifies the `sanity-preview-secret` (or `token`) query parameter against
 * SANITY_PREVIEW_SECRET using constant-time comparison to prevent timing attacks.
 * Returns true when the secret is not configured (dev convenience).
 */
export function verifyPreviewSecret(req: Request): boolean {
  const secret = process.env.SANITY_PREVIEW_SECRET
  if (!secret) return true

  const url = new URL(req.url)
  const token = url.searchParams.get('sanity-preview-secret') ?? url.searchParams.get('token')
  if (!token) return false

  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
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
