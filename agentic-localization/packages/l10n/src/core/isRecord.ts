/**
 * `sanity` exports this guard, but the node floor forbids importing it (see
 * `src/exports.test.ts`) and `@sanity/types` does not re-export it. One copy
 * here rather than one per module.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
