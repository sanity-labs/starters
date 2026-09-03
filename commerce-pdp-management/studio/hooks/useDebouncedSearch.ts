import {useCallback, useEffect, useRef, useState} from 'react'

export type DebouncedSearchFn<T> = (term: string, signal: AbortSignal) => Promise<T[]>

export type DebouncedSearch<T> = {
  /** The results of the most recent search that completed. */
  results: T[]
  /** True while a search is pending (debounce wait included). */
  loading: boolean
  /** Call on every keystroke; the search runs once typing pauses. */
  search: (term: string) => void
}

/**
 * Type-ahead search that stays in step with what the user typed. Keystrokes are
 * debounced so we do not hit the API on every character, and every request is
 * numbered so a slow response for an older term can never overwrite the results
 * of a newer one — the older request is aborted and its result ignored.
 *
 * @param searchFn Async function that runs one search; honour the `signal` so
 *   superseded requests are cancelled rather than just ignored.
 * @param delayMs How long typing must pause before a search fires.
 */
export function useDebouncedSearch<T>(
  searchFn: DebouncedSearchFn<T>,
  delayMs = 250,
): DebouncedSearch<T> {
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const latestRequestIdRef = useRef(0)

  const cancelPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const search = useCallback(
    (term: string) => {
      cancelPending()
      setLoading(true)

      const requestId = ++latestRequestIdRef.current
      const isLatest = () => requestId === latestRequestIdRef.current

      timerRef.current = setTimeout(async () => {
        const controller = new AbortController()
        controllerRef.current = controller

        try {
          const next = await searchFn(term, controller.signal)
          if (isLatest()) setResults(next)
        } catch (error) {
          const wasAborted = error instanceof DOMException && error.name === 'AbortError'
          if (!wasAborted && isLatest()) setResults([])
        } finally {
          if (isLatest()) setLoading(false)
        }
      }, delayMs)
    },
    [cancelPending, delayMs, searchFn],
  )

  // Abort anything in flight if the input unmounts mid-search.
  useEffect(() => cancelPending, [cancelPending])

  return {results, loading, search}
}
