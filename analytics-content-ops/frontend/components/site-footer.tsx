import Link from 'next/link'

const columns = [
  {
    heading: 'Sections',
    links: ['Journal', 'Adventures', 'Field Notes', 'Gear Reviews', 'Photography'],
  },
  {
    heading: 'Friluft',
    links: ['About us', 'Contributors', 'Editorial ethics', 'Careers', 'Contact'],
  },
  {heading: 'Follow', links: ['Newsletter', 'Instagram', 'YouTube', 'Podcast', 'RSS']},
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="flex flex-col leading-none">
              <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                Friluft
              </span>
              <span className="text-[0.62rem] font-medium uppercase tracking-[0.42em] text-muted-foreground">
                Media
              </span>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              An independent outdoor publication based in Norway — and a Sanity demo for
              analytics-informed content operations. Trending rails and triage views are powered by
              synced performance signal, not a separate analytics integration.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="/"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Friluft Media. A Sanity starter demo.</p>
          <p>
            Featured articles are real posts from the{' '}
            <a
              href="https://www.sanity.io/blog"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Sanity blog
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
