import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {presentationTool, defineDocuments} from 'sanity/presentation'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {SyncToProviderAction} from './components/SyncToProviderAction'
import {SendEmailAction} from './components/SendEmailAction'
import {SyncStatusBadge} from './components/SyncStatusBadge'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000'

export default defineConfig({
  name: 'default',
  title: 'Email Marketing Studio',

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
            route: '/campaigns/:slug',
            filter: '_type == "campaign" && slug.current == $slug',
          },
        ]),
      },
    }),
    structureTool({structure}),
    visionTool(),
  ],

  document: {
    actions: (prev, {schemaType}) => {
      if (schemaType === 'list' || schemaType === 'audience') {
        return [SyncToProviderAction, ...prev]
      }
      if (schemaType === 'emailMessage') {
        return [SendEmailAction, ...prev]
      }
      return prev
    },
    badges: (prev, {schemaType}) => {
      if (['list', 'audience', 'emailMessage'].includes(schemaType)) {
        return [...prev, SyncStatusBadge]
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
    templates: (prev) => [
      ...prev,
      {
        id: 'emailMessage-for-campaign',
        title: 'Email for Campaign',
        schemaType: 'emailMessage',
        parameters: [{name: 'campaignId', type: 'string'}],
        value: ({campaignId}: {campaignId: string}) => ({
          campaign: {_type: 'reference', _ref: campaignId, _weak: true},
        }),
      },
    ],
  },
})
