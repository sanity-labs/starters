import Link from 'next/link'

export function SiteNav() {
  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-gray-900">
          Beacon Help Center
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Browse
          </Link>
          <Link href="/search" className="text-gray-600 hover:text-gray-900">
            Search
          </Link>
          <Link
            href="/chat"
            className="rounded-full bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            Ask AI
          </Link>
        </div>
      </nav>
    </header>
  )
}
