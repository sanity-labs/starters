import {NextResponse, type NextRequest} from 'next/server'

const defaultLocale = 'en-US'
const localePattern = /^[a-z]{2}-[A-Z]{2}$/

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl
  const firstSegment = pathname.split('/')[1]

  if (localePattern.test(firstSegment)) return

  const preferredLocale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale

  request.nextUrl.pathname = `/${preferredLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
}
