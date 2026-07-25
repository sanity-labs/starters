'use client'

/**
 * The boundary for anything a page throws — a Sanity fetch that fails, a
 * malformed document. Sits beside `not-found.tsx` and for the same reason: the
 * root layout is `[lang]/layout.tsx`, so this is the highest boundary that
 * still renders inside `<html>`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  return (
    <main className="animate-fade-in py-20 text-center">
      <p className="text-sm font-medium text-[var(--color-accent)]">Something went wrong</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">This page could not be rendered</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">
        {error.digest ? `Reference ${error.digest}` : error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-[background-color] duration-[var(--transition-fast)] hover:bg-[var(--color-accent-hover)]"
      >
        Try again
      </button>
    </main>
  )
}
