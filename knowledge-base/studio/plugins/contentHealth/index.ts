import {ChartUpwardIcon} from '@sanity/icons'
import {definePlugin} from 'sanity'

import {ContentHealthDashboard} from './ContentHealthDashboard'

export const contentHealthTool = definePlugin({
  name: 'content-health-tool',
  tools: [
    {
      name: 'content-health',
      title: 'Content Health',
      icon: ChartUpwardIcon,
      component: ContentHealthDashboard,
    },
  ],
})
