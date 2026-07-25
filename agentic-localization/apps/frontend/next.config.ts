import type {NextConfig} from 'next'
import {sanity} from 'next-sanity/live/cache-life'

// Next.js loads workspace .env/.env.local before this file runs.
// Load root env as fallback (loadEnvFile won't overwrite).
for (const suffix of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(`${__dirname}/../../${suffix}`)
  } catch {}
}

const nextConfig: NextConfig = {
  // Sanity Live expires the cache tags `sanityFetch` writes, so the default
  // profile is the year-long one from `next-sanity/live/cache-life` rather
  // than time-based revalidation.
  cacheComponents: true,
  cacheLife: {default: sanity},
  experimental: {
    prefetchInlining: true,
  },
  env: {
    // Workspace .env.local wins if set (sanity init path), root SANITY_STUDIO_* as fallback
    NEXT_PUBLIC_SANITY_PROJECT_ID:
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET:
      process.env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.SANITY_STUDIO_DATASET,
  },
  images: {
    remotePatterns: [{hostname: 'cdn.sanity.io'}],
  },
}

export default nextConfig
