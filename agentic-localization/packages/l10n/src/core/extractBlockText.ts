/**
 * Extract plain text from a Portable Text block.
 *
 * Pure function — zero React/Sanity dependencies.
 * Safe to import in Sanity Functions runtime.
 *
 * Concatenates children[].text for standard text blocks.
 * For non-text blocks (images, custom types): returns [_type] placeholder.
 * Ignores marks (bold, italic, links) — diffing content, not formatting.
 */
export function extractBlockText(block: unknown): string {
  if (typeof block !== 'object' || block === null) return ''

  const obj = block as Record<string, unknown>

  // Standard text block: has children array with text spans
  if (Array.isArray(obj.children)) {
    return (obj.children as Array<Record<string, unknown>>)
      .map((child) => (typeof child.text === 'string' ? child.text : ''))
      .join('')
  }

  // Non-text block (image, custom type): show type placeholder
  if (typeof obj._type === 'string') {
    return `[${obj._type}]`
  }

  return ''
}
