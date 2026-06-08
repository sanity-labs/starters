import {agentContextPlugin} from '@sanity/agent-context/studio'
import {createClient} from '@sanity/client'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {defineDocuments, presentationTool} from 'sanity/presentation'
import {structureTool} from 'sanity/structure'

import {contentHealthTool} from './plugins/contentHealth'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000'

export default defineConfig({
  name: 'default',
  title: 'Knowledge Base',

  projectId,
  dataset,

  unstable_clientFactory: (options) =>
    createClient({...options, requestTagPrefix: `${options.requestTagPrefix}.knowledge-base`}),

  plugins: [
    structureTool({structure}),
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
            route: '/articles/:slug',
            filter: '_type == "helpArticle" && slug.current == $slug',
          },
        ]),
      },
    }),
    // Exposes content to agents through a hosted, schema-aware MCP endpoint.
    // Configure two contexts (external + internal) as documents in Studio.
    agentContextPlugin(),
    contentHealthTool(),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
