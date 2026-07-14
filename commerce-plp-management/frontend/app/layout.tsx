import './globals.css'

import type {Metadata} from 'next'
import {Inter, IBM_Plex_Mono} from 'next/font/google'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'

import {SanityLive} from '@/sanity/live'
import {getAudienceTag} from '@/lib/audience'
import {SiteHeader} from '@/components/SiteHeader'
import {SiteFooter} from '@/components/SiteFooter'

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Sanity Shop® — Commerce PLP management',
  description:
    'A Sanity Swag Store demo: merchandiser-controlled category pages on top of Shopify.',
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isEnabled: isDraftMode} = await draftMode()
  const audienceTag = await getAudienceTag()

  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-swag-black antialiased">
        <SiteHeader audienceTag={audienceTag} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  )
}
