import './globals.css'

import type {Metadata} from 'next'
import {Inter} from 'next/font/google'

import {ChatButton} from '@/components/chat'
import {Header} from '@/components/Header'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Winter Olympics Shop | Milano-Cortina 2026',
  description: 'Performance gear and apparel for the 2026 Winter Olympics',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Header />
        {children}
        <ChatButton />
      </body>
    </html>
  )
}
