export const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321'

export const SITE_INFO = {
  title: import.meta.env.SITE_TITLE || 'Keplar docs',
  summary:
    import.meta.env.SITE_SUMMARY ||
    'Documentation for Keplar, a fictional geospatial API. Sample content for the agent-ready-content starter.',
  url: SITE_URL,
}
