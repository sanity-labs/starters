import './globals.css'

import type {Metadata} from 'next'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'

import {SiteNav} from '@/components/site-nav'
import {SanityLive} from '@/sanity/live'

export const metadata: Metadata = {
  title: 'Beacon Help Center',
  description: 'A governed, AI-queryable knowledge base powered by Sanity',
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isEnabled: isDraftMode} = await draftMode()

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black font-sans">
        <SiteNav />
        {children}
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  )
}
