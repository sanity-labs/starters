import Link from 'next/link'

export function SiteNav() {
  return (
    <header className="border-b border-border-faint">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-fg-base">
          Beacon Help Center
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-fg-muted hover:text-fg-base">
            Browse
          </Link>
          <Link href="/search" className="text-fg-muted hover:text-fg-base">
            Search
          </Link>
          <Link href="/internal" className="text-fg-muted hover:text-fg-base">
            Internal
          </Link>
          <Link
            href="/chat"
            className="rounded-sm bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-hover duration-fast"
          >
            Ask AI
          </Link>
        </div>
      </nav>
    </header>
  )
}
