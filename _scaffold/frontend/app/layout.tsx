import "./globals.css";

import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";

import { SanityLive } from "@/sanity/live";

export const metadata: Metadata = {
  title: "Next.js + Sanity Starter",
  description: "A starter template for Next.js with Sanity CMS",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black font-sans">
        {children}
        <SanityLive />
        {isDraftMode && <VisualEditing />}
      </body>
    </html>
  );
}
