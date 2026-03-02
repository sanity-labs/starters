import {definePlugin} from 'sanity'
import {route} from 'sanity/router'

import {AgentInsightsTool} from './AgentInsightsTool'

export const agentInsightsPlugin = definePlugin({
  name: 'agent-insights',
  tools: [
    {
      name: 'agent-insights',
      title: 'Agent Insights',
      component: AgentInsightsTool,
      router: route.create('/:path', [route.create('/*')]),
    },
  ],
})
