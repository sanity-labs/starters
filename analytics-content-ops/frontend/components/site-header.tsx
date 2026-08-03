import Link from 'next/link'

const nav = [
  {label: 'Journal', href: '/'},
  {label: 'Adventures', href: '/'},
  {label: 'Field Notes', href: '/'},
  {label: 'Gear', href: '/'},
  {label: 'About', href: '/'},
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-4 md:px-10">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Friluft
          </span>
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.42em] text-muted-foreground">
            Media
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground lg:inline">
            Oslo · 4°C
          </span>
          <Link
            href="/"
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </header>
  )
}
