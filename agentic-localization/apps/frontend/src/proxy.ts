import {NextResponse, type NextRequest} from 'next/server'

import {DEFAULT_LANGUAGE} from '@/sanity/queries'

/**
 * Not `@starter/l10n`'s `isValidLocale`: the frontend depends on no workspace
 * package, so it can be cloned on its own. Must match the locale codes seeded
 * in `l10n.locale` — the same rule as `DEFAULT_LANGUAGE` in `sanity/queries.ts`.
 */
const localePattern = /^[a-z]{2}-[A-Z]{2}$/

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl
  const firstSegment = pathname.split('/')[1]

  if (localePattern.test(firstSegment)) return

  const preferredLocale = request.cookies.get('NEXT_LOCALE')?.value || DEFAULT_LANGUAGE

  request.nextUrl.pathname = `/${preferredLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  // Anything with an extension is a file, not a page: sitemap.xml, robots.txt
  // and favicon.ico must not be redirected under a locale prefix.
  matcher: ['/((?!_next|api|.*\\.).*)'],
}
