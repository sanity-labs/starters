/**
 * Ignores marks (bold, italic, links) — diffing content, not formatting.
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
