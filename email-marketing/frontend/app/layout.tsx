import './globals.css'

import type {Metadata} from 'next'
import Link from 'next/link'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'

import {SanityLive} from '@/sanity/live'

export const metadata: Metadata = {
  title: 'Email Marketing',
  description: 'Manage email campaigns, audiences, and previews with Sanity',
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isEnabled: isDraftMode} = await draftMode()

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black font-sans">
        <header className="border-b border-gray-200">
          <nav className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-6">
            <Link href="/" className="font-semibold text-lg hover:text-gray-600 transition-colors">
              Email Marketing
            </Link>
            <Link href="/" className="text-sm text-gray-500 hover:text-black transition-colors">
              Campaigns
            </Link>
          </nav>
        </header>
        {children}
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  )
}
