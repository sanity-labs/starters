export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const SITE_INFO = {
  title: process.env.NEXT_PUBLIC_SITE_TITLE || 'Keplar docs',
  summary:
    process.env.NEXT_PUBLIC_SITE_SUMMARY ||
    'Documentation for Keplar, a fictional geospatial API. Sample content for the agent-ready-content starter.',
  url: SITE_URL,
}
