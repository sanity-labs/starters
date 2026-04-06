import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {presentationTool, defineDocuments, defineLocations} from 'sanity/presentation'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {ImportFromKlaviyoAction} from './components/ImportFromKlaviyoAction'
import {SendEmailAction} from './components/SendEmailAction'
import {SendStatusBadge} from './components/SyncStatusBadge'
import {OpenKlaviyoAction} from './components/OpenKlaviyoAction'

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
            route: '/emails/preview/:id',
            resolve: (ctx) => ({
              filter: '_type == "emailMessage" && _id == $id',
              params: {id: ctx.params.id},
            }),
          },
        ]),
        locations: {
          emailMessage: defineLocations({
            select: {title: 'title', id: '_id'},
            resolve: (doc) => ({
              locations: [
                {title: doc?.title || 'Untitled Email', href: `/emails/preview/${doc?.id}`},
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
    actions: (prev, {schemaType}) => {
      if (schemaType === 'klaviyoImport') {
        return [ImportFromKlaviyoAction, OpenKlaviyoAction, ...prev]
      }
      if (schemaType === 'emailMessage') {
        return [SendEmailAction, ...prev]
      }
      if (schemaType === 'list' || schemaType === 'segment') {
        return prev.filter(({action}) => action !== 'delete' && action !== 'duplicate')
      }
      return prev
    },
    badges: (prev, {schemaType}) => {
      if (schemaType === 'emailMessage') {
        return [...prev, SendStatusBadge]
      }
      return prev
    },
  },

  schema: {
    types: schemaTypes,
    templates: (prev) =>
      prev.filter(
        (t) =>
          !['list', 'segment', 'klaviyoImport'].includes(
            'schemaType' in t ? (t.schemaType as string) : '',
          ),
      ),
  },
})
