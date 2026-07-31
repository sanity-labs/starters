import type {NextConfig} from 'next'

/**
 * The public contract: three behaviors on one URL.
 *
 * 1. /docs/section/article.md            -> markdown (explicit suffix)
 * 2. /docs/section/article + Accept hdr  -> markdown (content negotiation)
 * 3. /docs/section/article               -> HTML (default)
 *
 * beforeFiles runs the rewrites before Next.js resolves pages, so .md
 * requests never touch the HTML route and unmatched requests fall
 * through to the normal page.
 */
const nextConfig: NextConfig = {
  rewrites: async () => ({
    beforeFiles: [
      // Explicit .md URLs, no header required
      {
        source: '/docs/:section/:article.md',
        destination: '/md/:section/:article',
      },
      {
        source: '/docs/:section.md',
        destination: '/md/:section',
      },
      // Accept header negotiation
      {
        source: '/docs/:section/:article',
        destination: '/md/:section/:article',
        has: [{type: 'header', key: 'accept', value: '(.*)text/markdown(.*)'}],
      },
      {
        source: '/docs/:section',
        destination: '/md/:section',
        has: [{type: 'header', key: 'accept', value: '(.*)text/markdown(.*)'}],
      },
    ],
  }),
}

export default nextConfig
