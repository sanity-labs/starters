import type {StructureResolver} from 'sanity/structure'
import {
  ComposeIcon,
  ControlsIcon,
  DocumentsIcon,
  InboxIcon,
  RocketIcon,
  SparklesIcon,
  TagIcon,
} from '@sanity/icons'

const CATEGORIES = [
  {title: 'Care', value: 'care'},
  {title: 'Fit', value: 'fit'},
  {title: 'Lifestyle', value: 'lifestyle'},
  {title: 'Spec', value: 'spec'},
  {title: 'Launch', value: 'launch'},
] as const

/**
 * Content-team-first Structure. The Review Queue spans both enrichment types
 * (in-review), the control plane and brand voice are pinned singletons, and
 * attribute rules are browsable by category for large rule sets.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('PDP content')
    .items([
      S.listItem()
        .title('Review queue')
        .icon(InboxIcon)
        .child(
          S.documentList()
            .title('Review queue')
            .filter(
              '(_type == "attributeRule" && status == "in-review") || (_type == "skuEnrichment" && status == "draft")',
            )
            .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
        ),

      S.divider(),

      S.listItem()
        .title('Attribute rules')
        .icon(ComposeIcon)
        .child(
          S.list()
            .title('Attribute rules')
            .items([
              S.listItem()
                .title('All rules')
                .icon(DocumentsIcon)
                .child(
                  S.documentTypeList('attributeRule')
                    .title('All rules')
                    .defaultOrdering([{field: 'order', direction: 'asc'}]),
                ),
              S.divider(),
              ...CATEGORIES.map((cat) =>
                S.listItem()
                  .title(cat.title)
                  .icon(TagIcon)
                  .id(`category-${cat.value}`)
                  .child(
                    S.documentList()
                      .title(cat.title)
                      .filter('_type == "attributeRule" && category == $category')
                      .params({category: cat.value})
                      .defaultOrdering([{field: 'order', direction: 'asc'}]),
                  ),
              ),
            ]),
        ),

      S.listItem()
        .title('SKU enrichments')
        .icon(RocketIcon)
        .child(S.documentTypeList('skuEnrichment').title('SKU enrichments')),

      S.divider(),

      S.listItem()
        .title('Control plane')
        .icon(ControlsIcon)
        .child(S.document().schemaType('controlPlane').documentId('controlPlane')),

      S.listItem()
        .title('Brand voice')
        .icon(SparklesIcon)
        .child(S.document().schemaType('brandVoice').documentId('brandVoice')),
    ])
