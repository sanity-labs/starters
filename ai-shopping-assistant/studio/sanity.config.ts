import {AGENT_CONTEXT_SCHEMA_TYPE_NAME, agentContextPlugin} from '@sanity/agent-context/studio'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {type ListItemBuilder, type StructureBuilder, structureTool} from 'sanity/structure'

import {agentInsightsPlugin} from './agent-insights-tool/agentInsightsPlugin'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'starter-agent-context',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET!,

  plugins: [
    structureTool({
      structure: (S: StructureBuilder) => {
        // Document types to group under "Agents"
        const agentTypes = [AGENT_CONTEXT_SCHEMA_TYPE_NAME, 'agent.config', 'agent.conversation']

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
                    S.documentTypeListItem(AGENT_CONTEXT_SCHEMA_TYPE_NAME).title('Agent Contexts'),
                    S.documentTypeListItem('agent.conversation').title('Agent Conversations'),
                  ]),
              ),
          ])
      },
    }),
    visionTool(),
    agentContextPlugin(),
    agentInsightsPlugin(),
  ],

  schema: {
    types: schemaTypes,
  },
})
