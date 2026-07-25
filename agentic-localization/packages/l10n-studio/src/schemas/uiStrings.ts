import {defineType, defineField} from '@sanity/types'
import {StringIcon} from '@sanity/icons'

/**
 * The frontend's own chrome — nav labels, headings, the fallback notice — as a
 * single field-tier document.
 *
 * Chrome is content in every language the site ships, so it belongs in the same
 * translation workflow as the articles it frames rather than in a bundle the
 * frontend redeploys to change. One document, one `internationalizedArray` per
 * string: registering `l10n.uiStrings` in `FIELD_TIER` is what makes a
 * `localize-document` run fan it out per locale.
 *
 * A singleton: the frontend reads `*[_type == "l10n.uiStrings"][0]`, so nothing
 * depends on the id, but structure should pin one document.
 */
export const uiStrings = defineType({
  name: 'l10n.uiStrings',
  title: 'UI Strings',
  icon: StringIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'siteTitle',
      title: 'Site Title',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'siteTagline',
      title: 'Site Tagline',
      type: 'internationalizedArrayText',
    }),
    defineField({
      name: 'articlesHeading',
      title: 'Articles Heading',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'emptyArticles',
      title: 'Empty Article List',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'backToArticles',
      title: 'Back Link',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'homeLabel',
      title: 'Home Link',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'architectureLabel',
      title: 'Architecture Link',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'fallbackNotice',
      title: 'Fallback Notice',
      description:
        'Shown when an article has no translation. {locale} and {fallback} are replaced with locale codes.',
      type: 'internationalizedArrayText',
    }),
  ],
  preview: {
    select: {siteTitle: 'siteTitle'},
    prepare({siteTitle}) {
      const entries: unknown = siteTitle
      const source = Array.isArray(entries)
        ? entries.find((entry) => entry?.language === 'en-US')?.value
        : undefined
      return {title: 'UI Strings', subtitle: typeof source === 'string' ? source : undefined}
    },
  },
})
