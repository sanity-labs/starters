import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {presentationTool, defineDocuments, defineLocations} from 'sanity/presentation'
import {type DocumentBadgeComponent} from 'sanity'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {assist} from './plugins/assist'
import {ImportFromResendAction} from './components/ImportFromResendAction'
import {OpenResendAction} from './components/OpenResendAction'
import {LastSyncedBadge} from './plugins/esp'
import {GenerateVariantsAction} from './plugins/campaign'
import {
  ApproveAction,
  ResendAction,
  SendTestAction,
  RefinementInspector,
  PreviewStatusInspector,
  WorkflowStateBadge,
  SegmentBadge,
} from './plugins/promotion'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000'

export default defineConfig({
  name: 'default',
  title: 'Email Marketing Studio',

  projectId,
  dataset,

  plugins: [
    assist(),
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
            route: '/promotions/:id',
            resolve: (ctx) => ({
              filter: '_type == "promotion" && _id == $id',
              params: {id: ctx.params.id},
            }),
          },
          {
            route: '/campaigns/:id',
            resolve: (ctx) => ({
              filter: '_type == "campaign" && _id == $id',
              params: {id: ctx.params.id},
            }),
          },
        ]),
        locations: {
          promotion: defineLocations({
            select: {id: '_id', subjectLine: 'subjectLine'},
            resolve: (doc) => ({
              locations: [
                {
                  title: doc?.subjectLine ?? 'Preview',
                  href: `/promotions/${doc?.id}`,
                },
              ],
            }),
          }),
          campaign: defineLocations({
            select: {id: '_id', title: 'title'},
            resolve: (doc) => ({
              locations: [
                {
                  title: doc?.title ?? 'Campaign',
                  href: `/campaigns/${doc?.id}`,
                },
              ],
            }),
          }),
        },
      },
    }),
    structureTool({structure}),
    visionTool(),
  ],

  document: {
    productionUrl: async (prev, {document}) => {
      if (document._type === 'promotion') {
        return `${previewUrl}/api/preview/resend/${document._id}`
      }
      return prev
    },
    actions: (prev, {schemaType}) => {
      if (schemaType === 'espImport') {
        return [ImportFromResendAction, OpenResendAction, ...prev]
      }
      if (schemaType === 'campaign') {
        return [GenerateVariantsAction, ...prev]
      }
      if (schemaType === 'promotion') {
        return [
          ApproveAction,
          ResendAction,
          SendTestAction,
          ...prev.filter(({action}) => action !== 'publish'),
        ]
      }
      if (schemaType === 'segment') {
        return prev.filter(({action}) => action !== 'delete' && action !== 'duplicate')
      }
      return prev
    },
    badges: (prev, {schemaType}): DocumentBadgeComponent[] => {
      if (schemaType === 'promotion') {
        return [WorkflowStateBadge, SegmentBadge, ...prev]
      }
      if (schemaType === 'espImport') {
        return [LastSyncedBadge]
      }
      return prev
    },
    inspectors: (prev, {documentType}) => {
      if (documentType === 'promotion') {
        return [...prev, PreviewStatusInspector, RefinementInspector]
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
    templates: (prev) =>
      prev.filter(
        (t) =>
          !['segment', 'espImport', 'workflow.state'].includes(
            'schemaType' in t ? (t.schemaType as string) : '',
          ),
      ),
  },
})
