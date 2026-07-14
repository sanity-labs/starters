import Link from 'next/link'
import {AudienceSwitcher} from './AudienceSwitcher'

export function SiteHeader({audienceTag}: {audienceTag: string | null}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-swag-black bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Sanity
        </Link>
        <span className="chip">Shop®</span>
      </div>

      <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
        <Link href="/" className="hover:underline underline-offset-4">
          Collections
        </Link>
        <a href="#" className="hover:underline underline-offset-4">
          About
        </a>
        <AudienceSwitcher current={audienceTag} />
      </nav>
    </header>
  )
}
