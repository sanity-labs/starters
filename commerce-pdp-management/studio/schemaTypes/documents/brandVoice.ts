import {defineArrayMember, defineField, defineType} from 'sanity'
import {SparklesIcon} from '@sanity/icons'

/**
 * Singleton. The single source of truth for AI-generated PDP content. The content
 * manager owns this document; `contextPrompt` is wired to the org-level Content
 * Agent prompt at setup, so updates here propagate to every future generation run
 * without a code change.
 */
export const brandVoice = defineType({
  name: 'brandVoice',
  title: 'Brand voice',
  type: 'document',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'persona',
      title: 'Persona',
      type: 'blockContent',
      description: 'Who the brand speaks to and as.',
    }),
    defineField({
      name: 'toneGuidance',
      title: 'Tone guidance',
      type: 'blockContent',
      description: 'Voice adjectives and do/don’t direction.',
    }),
    defineField({
      name: 'contextPrompt',
      title: 'Context prompt',
      type: 'text',
      rows: 6,
      description:
        'Condensed system-prompt fragment injected into AI generation. Wire this to the org-level Content Agent prompt at setup.',
    }),
    defineField({
      name: 'examplePhrases',
      title: 'Example phrases',
      type: 'array',
      of: [defineArrayMember({type: 'examplePhrase'})],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Brand voice'}
    },
  },
})
