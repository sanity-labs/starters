import type {StructureResolver} from 'sanity/structure'
import {ThLargeIcon, StarIcon, TagIcon, RocketIcon} from '@sanity/icons'

/**
 * Merchandiser-first Structure. Collections are split by type so the team can
 * jump straight to the campaign collections they own, and the badge vocabulary
 * is a top-level, shared list.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Merchandising')
    .items([
      S.listItem()
        .title('All collections')
        .icon(ThLargeIcon)
        .child(
          S.documentTypeList('collectionEnrichment')
            .title('All collections')
            .defaultOrdering([{field: 'handle.current', direction: 'asc'}]),
        ),

      S.listItem()
        .title('Enriched (Shopify-native)')
        .icon(StarIcon)
        .child(
          S.documentList()
            .title('Enriched collections')
            .filter('_type == "collectionEnrichment" && collectionType == "shopify-native"')
            .defaultOrdering([{field: 'handle.current', direction: 'asc'}]),
        ),

      S.listItem()
        .title('Custom campaign collections')
        .icon(RocketIcon)
        .child(
          S.documentList()
            .title('Custom campaign collections')
            .filter('_type == "collectionEnrichment" && collectionType == "sanity-custom"')
            .defaultOrdering([{field: 'handle.current', direction: 'asc'}]),
        ),

      S.divider(),

      S.listItem()
        .title('Badge vocabulary')
        .icon(TagIcon)
        .child(S.documentTypeList('productBadge').title('Badge vocabulary')),
    ])
