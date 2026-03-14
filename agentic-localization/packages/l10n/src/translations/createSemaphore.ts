/**
 * Promise-based semaphore — limits concurrent async operations.
 * Shared across doc-level and field-level translation actions.
 */

export interface Semaphore {
  acquire(): Promise<void>
  release(): void
}

export function createSemaphore(max: number): Semaphore {
  let count = 0
  const waiting: Array<() => void> = []
  return {
    acquire() {
      if (count < max) {
        count++
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => waiting.push(resolve))
    },
    release() {
      count--
      const next = waiting.shift()
      if (next) {
        count++
        next()
      }
    },
  }
}
