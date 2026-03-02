import {defineField, defineType} from 'sanity'

export const agentConfig = defineType({
  name: 'agent.config',
  title: 'Agent Configs',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Display name for this config (e.g., "Shopping Assistant")',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description:
        'The app loads the config with slug "default". Use Generate to create from the name.',
      options: {
        source: 'name',
      },
      initialValue: {current: 'default'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'systemPrompt',
      title: 'System Prompt',
      type: 'text',
      description:
        'Tell the agent who it is and how to behave (tone, persona, boundaries). The app automatically appends product-specific instructions at runtime.',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'slug.current',
    },
  },
})
