/**
 * Subscribes to an agent action Subscribable and returns a Promise that
 * resolves with the first emitted value.
 *
 * Agent action hooks (useAgentTranslate, useAgentGenerate, etc.) return
 * Subscribables that emit results via next(). This utility bridges the
 * Subscribable into Promise-based control flow needed for sequential
 * processing — e.g., translating documents one at a time with async
 * post-processing (slug gen, metadata patch) between each.
 *
 * - Resolves on the first next() emission
 * - Supports cancellation via AbortSignal — unsubscribes and rejects
 * - Cleans up the subscription after settling
 */

export function awaitAgentResult<T = unknown>(
  subscribable: {
    subscribe(observer: {
      complete?: () => void
      error?: (err: unknown) => void
      next?: (value: T) => void
    }): {unsubscribe(): void} | void
  },
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Translation cancelled', 'AbortError'))
      return
    }

    let settled = false
    let unsubscribe: (() => void) | undefined

    const guard = (fn: () => void) => {
      if (settled) return
      settled = true
      unsubscribe?.()
      fn()
    }

    const subscription = subscribable.subscribe({
      complete: () => guard(() => resolve(undefined as T)),
      error: (err) => guard(() => reject(err)),
      next: (value) => guard(() => resolve(value)),
    })

    if (subscription && typeof subscription === 'object' && 'unsubscribe' in subscription) {
      unsubscribe = () => (subscription as {unsubscribe(): void}).unsubscribe()
    }

    signal?.addEventListener(
      'abort',
      () => guard(() => reject(new DOMException('Translation cancelled', 'AbortError'))),
      {once: true},
    )
  })
}

/**
 * Type guard for AbortError — use in catch blocks to distinguish
 * cancellation from real errors.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}
