import DOMPurify from 'isomorphic-dompurify'

export interface SanitizeOptions {
  allowedTags?: string[]
  allowedAttributes?: string[]
}

const EMAIL_SANITIZE_OPTIONS: SanitizeOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'table',
    'tr',
    'td',
    'th',
    'div',
    'span',
    'section',
    'article',
    'header',
    'footer',
  ],
  allowedAttributes: ['href', 'src', 'alt', 'width', 'height', 'style', 'class'],
}

export async function* sanitizeHtml(
  source: AsyncIterable<string>,
  options: SanitizeOptions = {},
): AsyncGenerator<string> {
  let buffer = ''

  for await (const chunk of source) {
    buffer += chunk

    const lastTagEnd = buffer.lastIndexOf('>')
    if (lastTagEnd === -1) continue

    const toSanitize = buffer.slice(0, lastTagEnd + 1)
    buffer = buffer.slice(lastTagEnd + 1)

    const sanitized = DOMPurify.sanitize(toSanitize, {
      ALLOWED_TAGS: options.allowedTags,
      ALLOWED_ATTR: options.allowedAttributes,
    })
    if (sanitized) yield sanitized
  }

  if (buffer) {
    const sanitized = DOMPurify.sanitize(buffer, {
      ALLOWED_TAGS: options.allowedTags,
      ALLOWED_ATTR: options.allowedAttributes,
    })
    if (sanitized) yield sanitized
  }
}
