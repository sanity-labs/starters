import {defineField, defineType} from 'sanity'

/**
 * Brand Voice (singleton)
 *
 * Supplemental context for @sanity/context.
 * Brand-wide tone traits, writing style, prohibitions, legal constraints.
 */
export const brandVoice = defineType({
  name: 'brandVoice',
  title: 'Brand Voice',
  type: 'document',
  fields: [
    defineField({
      name: 'toneTraits',
      title: 'Brand Tone Traits',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
      description: 'e.g., inclusive, irreverent, data-backed, trustworthy',
    }),
    defineField({
      name: 'writingStyleRules',
      title: 'Writing Style Rules',
      type: 'array',
      of: [{type: 'string'}],
      description:
        'e.g., "always use Oxford comma", "avoid passive voice", "use imperatives for CTAs"',
    }),
    defineField({
      name: 'prohibitedWords',
      title: 'Prohibited Words / Phrases',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Words to avoid in generated copy.',
    }),
    defineField({
      name: 'emailGuidelines',
      title: 'Email-Specific Guidelines',
      type: 'text',
      rows: 5,
      description: 'Subject line patterns, CTA vocabulary, urgency framing rules.',
    }),
    defineField({
      name: 'legalConstraints',
      title: 'Legal & Compliance Constraints',
      type: 'text',
      rows: 5,
      description: 'e.g., required opt-out language, CAN-SPAM rules, disclaimer text.',
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Brand Voice',
      subtitle: 'Supplemental context for AI generation',
    }),
  },
})
