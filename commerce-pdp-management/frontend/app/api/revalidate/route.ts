import {revalidatePath} from 'next/cache'
import {type NextRequest, NextResponse} from 'next/server'

/**
 * On-demand revalidation endpoint. The `cache-revalidate` Sanity Function calls
 * this on publish of a controlPlane / attributeRule / skuEnrichment document to
 * invalidate the storefront's cached PDPs — the PRD's "CDN cache invalidation on
 * control plane publish".
 *
 * Guarded by SANITY_REVALIDATE_SECRET so only the Function can trigger it. A
 * control-plane or rule change affects many products, so by default we revalidate
 * every product page; a specific `handle` narrows it to one PDP.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const provided = request.headers.get('x-revalidate-secret')

  if (!secret || provided !== secret) {
    return NextResponse.json({revalidated: false, message: 'Invalid secret'}, {status: 401})
  }

  const body = (await request.json().catch(() => ({}))) as {handle?: string}

  if (body.handle) {
    revalidatePath(`/products/${body.handle}`)
  } else {
    revalidatePath('/products/[handle]', 'page')
  }
  revalidatePath('/')

  return NextResponse.json({revalidated: true, now: Date.now(), handle: body.handle ?? null})
}
