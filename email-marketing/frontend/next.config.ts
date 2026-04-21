import type {NextConfig} from 'next'
import path from 'node:path'

const config: NextConfig = {
  images: {
    remotePatterns: [{hostname: 'cdn.sanity.io'}, {hostname: 'placehold.co'}],
  },
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  transpilePackages: ['@starter/render-email'],
}

export default config
