import type {NextConfig} from 'next'

// Load root .env — Next.js only reads env files from its own directory,
// but the monorepo keeps all Sanity env vars at the repo root.
try {
  process.loadEnvFile(`${__dirname}/../../.env`)
} catch {}

const nextConfig: NextConfig = {
  env: {
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
