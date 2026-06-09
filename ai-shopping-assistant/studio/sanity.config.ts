import {CONTEXT_SCHEMA_TYPE_NAME, contextPlugin} from '@sanity/context/studio'
import {visionTool} from '@sanity/vision'
import {createClient} from '@sanity/client'
import {defineConfig} from 'sanity'
import {type ListItemBuilder, type StructureBuilder, structureTool} from 'sanity/structure'

import {agentInsightsPlugin} from './agent-insights-tool/agentInsightsPlugin'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'starter-context',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET!,

  unstable_clientFactory: (options) =>
    createClient({...options, requestTagPrefix: `${options.requestTagPrefix}.ai-shopping-assistant`}),

  plugins: [
    structureTool({
      structure: (S: StructureBuilder) => {
        // Document types to group under "Agents"
        const agentTypes = [CONTEXT_SCHEMA_TYPE_NAME, 'agent.config', 'agent.conversation']

        // Get all schema types except agent-related types
        const defaultListItems = S.documentTypeListItems().filter(
          (item: ListItemBuilder) => !agentTypes.includes(item.getId() ?? ''),
        )

        return S.list()
          .title('Content')
          .items([
            ...defaultListItems,
            S.divider(),
            // Group agent related document types together
            S.listItem()
              .title('Agents')
              .child(
                S.list()
                  .title('Agents')
                  .items([
                    S.documentTypeListItem('agent.config').title('Agent Configs'),
                    S.documentTypeListItem(CONTEXT_SCHEMA_TYPE_NAME).title('Sanity Contexts'),
                    S.documentTypeListItem('agent.conversation').title('Agent Conversations'),
                  ]),
              ),
          ])
      },
    }),
    visionTool(),
    contextPlugin(),
    agentInsightsPlugin(),
  ],

  schema: {
    types: schemaTypes,
  },
})
