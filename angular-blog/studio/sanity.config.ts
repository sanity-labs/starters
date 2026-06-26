import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {presentationTool, defineDocuments, defineLocations} from 'sanity/presentation'
import {schemaTypes} from './schemaTypes'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:4200'

export default defineConfig({
  name: 'default',
  title: 'Angular Blog',

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
            route: '/',
            filter: '_type == "settings"',
          },
          {
            route: '/posts/:slug',
            filter: '_type == "post" && slug.current == $slug',
          },
        ]),
        locations: {
          post: defineLocations({
            select: {
              title: 'title',
              slug: 'slug.current',
            },
            resolve: (doc) => ({
              locations: [
                {
                  title: doc?.title ?? 'Post',
                  href: doc?.slug ? `/posts/${doc.slug}` : '/',
                },
                {
                  title: 'Blog home',
                  href: '/',
                },
              ],
            }),
          }),
          settings: defineLocations({
            select: {title: 'title'},
            resolve: (doc) => ({
              locations: [
                {
                  title: doc?.title ?? 'Blog home',
                  href: '/',
                },
              ],
            }),
          }),
        },
      },
    }),
    structureTool(),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
