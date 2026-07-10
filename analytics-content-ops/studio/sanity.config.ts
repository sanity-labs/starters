import {defineConfig, type DocumentBadgeComponent} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {presentationTool, defineDocuments} from 'sanity/presentation'
import {schemaTypes} from './schemaTypes'
import {structure, defaultDocumentNode} from './structure'
import {PerformanceTierBadge} from './components/PerformanceTierBadge'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000'

// Sync-owned types that editors should never create by hand.
const SYNC_OWNED = ['articlePerformance', 'analyticsContext']

export default defineConfig({
  name: 'default',
  title: 'Analytics Content Ops',

  projectId,
  dataset,

  plugins: [
    presentationTool({
      previewUrl: {
        origin: previewUrl,
        previewMode: {
          enable: '/api/draft-mode/enable',
        },
      },
      resolve: {
        mainDocuments: defineDocuments([
          {
            route: '/article/:slug',
            filter: '_type == "article" && slug.current == $slug',
          },
        ]),
      },
    }),
    structureTool({structure, defaultDocumentNode}),
    visionTool(),
  ],

  document: {
    badges: (prev, {schemaType}): DocumentBadgeComponent[] => {
      if (schemaType === 'article') {
        return [PerformanceTierBadge, ...prev]
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
    templates: (prev) =>
      prev.filter((t) => !SYNC_OWNED.includes('schemaType' in t ? (t.schemaType as string) : '')),
  },
})
