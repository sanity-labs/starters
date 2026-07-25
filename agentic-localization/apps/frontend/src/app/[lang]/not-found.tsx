import Link from 'next/link'

/**
 * Under `[lang]/` because that is where the root layout is — this app has no
 * `app/layout.tsx`, so a boundary above the locale segment would render without
 * `<html>`. Every 404 reaches it anyway: the proxy prefixes a locale onto any
 * path that lacks one before routing sees it.
 *
 * Not localized: `not-found.tsx` takes no params, and the copy an editor cares
 * about lives on pages that resolved.
 */
export default function NotFound() {
  return (
    <main className="animate-fade-in py-20 text-center">
      <p className="text-sm font-medium text-[var(--color-accent)]">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">This page does not exist</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">
        It may not be published yet, or not translated into any locale that falls back to this one.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-[background-color] duration-[var(--transition-fast)] hover:bg-[var(--color-accent-hover)]"
      >
        Back to the homepage
      </Link>
    </main>
  )
}
