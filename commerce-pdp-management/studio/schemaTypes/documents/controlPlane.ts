import {defineArrayMember, defineField, defineType} from 'sanity'
import {ControlsIcon} from '@sanity/icons'

/**
 * Singleton. The editorial control plane: which attribute rules are active and
 * in what resolution priority. Editing this one prioritized list changes what
 * appears on thousands of product pages. Rules earlier in the list win within a
 * category ("first-match wins"); publishing invalidates the storefront CDN cache.
 */
export const controlPlane = defineType({
  name: 'controlPlane',
  title: 'Control plane',
  type: 'document',
  icon: ControlsIcon,
  fields: [
    defineField({
      name: 'priorityList',
      title: 'Priority list',
      type: 'array',
      description:
        'Approved attribute rules in resolution order. Drag to reprioritize. Higher = evaluated first.',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'attributeRule'}],
          options: {filter: 'status == "approved"'},
        }),
      ],
    }),
    defineField({
      name: 'productTypeScopes',
      title: 'Product-type scopes',
      type: 'array',
      description:
        'Optional per-product-type priority overrides for brands with distinct taxonomies.',
      of: [defineArrayMember({type: 'productTypeScope'})],
    }),
  ],
  preview: {
    select: {rules: 'priorityList', scopes: 'productTypeScopes'},
    prepare({rules, scopes}) {
      const ruleCount = Array.isArray(rules) ? rules.length : 0
      const scopeCount = Array.isArray(scopes) ? scopes.length : 0
      return {
        title: 'Control plane',
        subtitle: `${ruleCount} active rule(s)${scopeCount ? ` · ${scopeCount} scope(s)` : ''}`,
      }
    },
  },
})
