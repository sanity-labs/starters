import type {Metadata} from 'next'
import type {ReactNode} from 'react'
import Link from 'next/link'
import {SITE_INFO} from '@/lib/config'

export const metadata: Metadata = {
  title: SITE_INFO.title,
  description: SITE_INFO.summary,
}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 720,
          margin: '0 auto',
          padding: '2rem 1rem',
          lineHeight: 1.6,
        }}
      >
        <header
          style={{marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'baseline'}}
        >
          <Link href="/" style={{fontWeight: 700, textDecoration: 'none', color: 'inherit'}}>
            {SITE_INFO.title}
          </Link>
          <nav style={{display: 'flex', gap: '0.75rem', fontSize: '0.875rem'}}>
            <a href="/sitemap.md">sitemap.md</a>
            <a href="/llms.txt">llms.txt</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
