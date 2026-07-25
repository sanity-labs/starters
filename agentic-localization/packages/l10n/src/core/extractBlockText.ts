/**
 * Ignores marks (bold, italic, links) — diffing content, not formatting.
 *
 * Not `@portabletext/toolkit`'s `toPlainText`: that skips a non-block object
 * silently, so a removed image or embed would diff as no change at all — this
 * emits an `[_type]` marker instead — and it pads the blocks it joins, which a
 * one-block-at-a-time extract must not do.
 */
export function extractBlockText(block: unknown): string {
  if (typeof block !== 'object' || block === null) return ''

  const obj = block as Record<string, unknown>

  if (Array.isArray(obj.children)) {
    return (obj.children as Array<Record<string, unknown>>)
      .map((child) => (typeof child.text === 'string' ? child.text : ''))
      .join('')
  }

  if (typeof obj._type === 'string') {
    return `[${obj._type}]`
  }

  return ''
}
