import {NextResponse, type NextRequest} from 'next/server'

import {LOCALE_PATTERN, negotiateLocale} from '@/negotiateLocale'
import {DEFAULT_LANGUAGE} from '@/sanity/queries'

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl
  const firstSegment = pathname.split('/')[1]

  if (LOCALE_PATTERN.test(firstSegment)) return

  // An explicit choice outranks a browser preference: the cookie is written by
  // the locale switcher, so it is the visitor saying so rather than a guess.
  const chosen = request.cookies.get('NEXT_LOCALE')?.value
  const preferredLocale =
    (chosen && LOCALE_PATTERN.test(chosen) ? chosen : null) ??
    negotiateLocale(request.headers.get('accept-language')) ??
    DEFAULT_LANGUAGE

  request.nextUrl.pathname = `/${preferredLocale}${pathname}`

  const response = NextResponse.redirect(request.nextUrl)
  // Both inputs to the choice above, so a shared cache cannot hand one
  // visitor's redirect to the next.
  response.headers.set('Vary', 'Accept-Language, Cookie')
  return response
}

export const config = {
  // Anything with an extension is a file, not a page: sitemap.xml, robots.txt
  // and favicon.ico must not be redirected under a locale prefix.
  matcher: ['/((?!_next|api|.*\\.).*)'],
}
