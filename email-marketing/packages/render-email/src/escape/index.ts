/**
 * Dependency-free escaping helpers shared by every surface that turns Sanity
 * content into HTML: the MJML renderer behind the preview route and the
 * hand-built HTML in the `on-promotion-approved` Function that Klaviyo sends
 * to real subscribers. Lives in its own subpath so a Function bundle can
 * import it without pulling in mjml.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escapes a content string for interpolation into HTML text or a quoted
 * attribute value so authored copy can never open a tag or break out of an
 * attribute. Nullish input renders as an empty string.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Returns the URL when it is an absolute http(s) URL, otherwise `undefined`.
 * Guards `href`/`src` attributes against `javascript:`, `data:`, and other
 * schemes a browser or email client would execute instead of fetch. Callers
 * should still run the result through {@link escapeHtml} before interpolating.
 */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  try {
    const {protocol} = new URL(trimmed)
    return SAFE_URL_PROTOCOLS.has(protocol) ? trimmed : undefined
  } catch {
    return undefined
  }
}
