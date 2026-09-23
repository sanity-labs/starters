import './globals.css'

import type {Metadata} from 'next'
import {Geist, IBM_Plex_Mono} from 'next/font/google'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'

import {SiteNav} from '@/components/site-nav'
import {SanityLive} from '@/sanity/live'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
})

export const metadata: Metadata = {
  title: 'Beacon Help Center',
  description:
    'Beacon help center. GROQ for structured facts. A Knowledge Base for grounded prose you can correct.',
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isEnabled: isDraftMode} = await draftMode()

  return (
    <html lang="en" data-theme="light" className={`${geist.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-bg-base text-fg-base font-sans antialiased">
        <SiteNav />
        {children}
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  )
}
