import './globals.css'

import type {Metadata, Viewport} from 'next'
import {Fraunces, Inter} from 'next/font/google'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'

import {SanityLive} from '@/sanity/live'

const fraunces = Fraunces({subsets: ['latin'], variable: '--font-fraunces', display: 'swap'})
const inter = Inter({subsets: ['latin'], variable: '--font-inter', display: 'swap'})

export const metadata: Metadata = {
  title: 'Friluft Media — analytics-informed content operations',
  description:
    'A Sanity starter that turns analytics signal into editorial action: trending rails powered by GROQ, performance context in Studio, and automated Content Agent triage.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f2efe9',
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isEnabled: isDraftMode} = await draftMode()

  return (
    <html lang="en" className={`light ${fraunces.variable} ${inter.variable}`}>
      <body className="bg-background font-sans antialiased">
        {children}
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  )
}
