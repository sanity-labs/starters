import {defineConfig} from 'astro/config'
import node from '@astrojs/node'

/**
 * Server output is what makes Accept header negotiation possible:
 * the middleware needs to run per request. A fully static build keeps
 * the .md endpoints (prerendered) but loses the header path; if you
 * deploy static, delete src/middleware.ts and rely on explicit .md URLs.
 */
export default defineConfig({
  output: 'server',
  adapter: node({mode: 'standalone'}),
  site: process.env.SITE_URL || 'http://localhost:4321',
})
