import {defineMiddleware} from 'astro:middleware'

/**
 * Accept header content negotiation. Explicit .md URLs are handled by
 * the endpoint files; this middleware covers the header path by
 * rewriting negotiated requests onto those same endpoints.
 */
export const onRequest = defineMiddleware((context, next) => {
  const {pathname} = context.url
  const accept = context.request.headers.get('accept') ?? ''

  if (
    pathname.startsWith('/docs/') &&
    !pathname.endsWith('.md') &&
    accept.includes('text/markdown')
  ) {
    return next(pathname + '.md')
  }

  return next()
})
