import DOMPurify from 'isomorphic-dompurify'

/**
 * Elements that never belong in a browser-rendered email preview regardless of
 * DOMPurify's defaults: anything that executes, embeds, navigates, or submits.
 */
const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'base',
  'link',
]

/**
 * Sanitizes a complete rendered email document before it is served to a
 * browser. The whole document is buffered and DOMPurify runs exactly once:
 * chunk-wise sanitizing cannot tell a tag-closing `>` from one inside a quoted
 * attribute, so a payload split across a chunk boundary would be sanitized as
 * two harmless-looking fragments. Emails are small, so buffering is free.
 *
 * Keeps the `<html>/<head>/<style>` scaffolding MJML emits, strips scripts,
 * event handlers, and non-http(s) URLs, and leaves Klaviyo Handlebars tokens
 * (`{{ unsubscribe_url }}`) intact so the accuracy badge can still count them.
 * Preview only: Outlook conditional comments do not survive it, so the send
 * path relies on escaping at render time instead.
 */
export function sanitizeEmailHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: FORBIDDEN_TAGS,
    ALLOW_DATA_ATTR: false,
  })
  return `<!doctype html>\n${sanitized}`
}
