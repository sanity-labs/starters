import type {NextConfig} from 'next'

const config: NextConfig = {
  // @starter/commerce ships TypeScript source; transpile it for the server bundle.
  transpilePackages: ['@starter/commerce'],
  images: {
    remotePatterns: [{hostname: 'cdn.sanity.io'}, {hostname: 'cdn.shopify.com'}],
  },
}

export default config
